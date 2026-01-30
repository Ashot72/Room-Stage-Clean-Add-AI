import { fal } from "@fal-ai/client";
import sharp from 'sharp';

// Initialize fal.ai client with API key
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

// Helper function to create mask from polygon and upload to fal.storage
async function createMaskFromPolygon(imageUrl: string, polygon: Array<{x: number, y: number}>): Promise<string> {
  // Fetch the image
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  
  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;
  
  // Create SVG path for polygon
  const pathData = polygon.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x * width} ${p.y * height}`
  ).join(' ') + ' Z';
  
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="black"/>
      <path d="${pathData}" fill="white"/>
    </svg>
  `;
  
  // Create mask image
  const maskBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  // Upload to fal.storage
  // Convert Buffer to Uint8Array for File constructor
  const maskArray = new Uint8Array(maskBuffer);
  const maskFile = new File([maskArray], 'mask.png', { type: 'image/png' });
  const maskUrl = await fal.storage.upload(maskFile);
  
  return maskUrl;
}

export async function POST(req: Request) {
  try {
    if (!process.env.FAL_KEY) {
      return Response.json(
        { error: "FAL_KEY is not configured. Please set it in .env.local" },
        { status: 500 }
      );
    }

    const { action, imageUrl, videoUrl, prompt, selection, referenceImageUrl, horizontal_angle, vertical_angle, zoom, duration, pointPrompts } = await req.json();

    if (action !== "add-audio" && !imageUrl) {
      return Response.json({ error: "Image URL is required" }, { status: 400 });
    }

    let result; 
    
    switch (action) {
      case "clean":
        // POLYGON SELECTION: Convert to mask and use object-removal/mask
        if (selection && Array.isArray(selection) && selection.length >= 3) {
          const maskUrl = await createMaskFromPolygon(imageUrl, selection);
          result = await fal.subscribe("fal-ai/object-removal/mask", {
            input: {
              image_url: imageUrl,
              mask_url: maskUrl,
              model: "best_quality",
              mask_expansion: 15
            }
          });
        } else if (prompt) {
          // PROMPT-BASED REMOVAL: Keep original object-removal API
          result = await fal.subscribe("fal-ai/object-removal", {
            input: { 
              image_url: imageUrl, 
              prompt              
            }
          });
        } else {
          return Response.json({ error: "Either polygon selection or prompt is required for cleaning" }, { status: 400 });
        }
        // Handle both result.data and result directly
        const cleanData = result.data || result;
        return Response.json({ imageUrl: cleanData.images[0].url });

      case "stage":
        // This model is specifically fine-tuned for interior design/staging
        if (!prompt) {
          return Response.json({ error: "Prompt is required for staging" }, { status: 400 });
        }
        result = await fal.subscribe("fal-ai/flux-2-lora-gallery/apartment-staging", {
          input: {
            image_urls: [imageUrl], 
            prompt: `A high-end ${prompt} style room with modern furniture, realistic lighting, and professional decor.`,
            // LoRA scale: 1.0 is standard; higher (up to 2.0) adds more furniture
            lora_scale: 1.2, 
            guidance_scale: 3.5,
            num_inference_steps: 30,
            image_size: "square_hd"
          }
        });
        // Handle both result.data and result directly
        const stageData = result.data || result;
        return Response.json({ imageUrl: stageData.images[0].url });

      case "add-item":
        // Add item to image using polygon selection
        if (!selection || !Array.isArray(selection) || selection.length < 3) {
          return Response.json({ error: "Polygon selection is required for adding items" }, { status: 400 });
        }
        if (!prompt) {
          return Response.json({ error: "Prompt is required for adding items" }, { status: 400 });
        }
        
        // Create mask from polygon
        const addItemMaskUrl = await createMaskFromPolygon(imageUrl, selection);
        
        if (referenceImageUrl) {
          // Mode 2: With reference image - use flux-kontext-lora/inpaint
          
          result = await fal.subscribe("fal-ai/flux-kontext-lora/inpaint", {
            input: {
              image_url: imageUrl,
              mask_url: addItemMaskUrl,
              reference_image_url: referenceImageUrl,
              prompt: prompt,
              strength: 0.65,
              guidance_scale: 3.5,
              num_inference_steps: 40
            }
          });
          
        } else {
          // Mode 1: Prompt only - use flux-pro/v1/fill
          result = await fal.subscribe("fal-ai/flux-pro/v1/fill", {
            input: {
              image_url: imageUrl,
              mask_url: addItemMaskUrl,
              prompt: prompt,
              safety_tolerance: "5"
            }
          });
        }
        // Handle both result.data and result directly
        const addItemData = result.data || result;
        return Response.json({ imageUrl: addItemData.images[0].url });

      case "different-angles":
        // Generate image from different camera angle
        if (horizontal_angle === undefined || vertical_angle === undefined || zoom === undefined) {
          return Response.json({ error: "Angle parameters (horizontal_angle, vertical_angle, zoom) are required for different angles" }, { status: 400 });
        }
        result = await fal.subscribe("fal-ai/qwen-image-edit-2511-multiple-angles", {
          input: {
            image_urls: [imageUrl],
            horizontal_angle: horizontal_angle,
            vertical_angle: vertical_angle,
            zoom: zoom,
            lora_scale: 1,
            guidance_scale: 4.5,
            num_inference_steps: 28,
            acceleration: "regular",
            enable_safety_checker: true,
            output_format: "png",
            num_images: 1,
          }
        });
        // Handle both result.data and result directly
        const angleData = result.data || result;
        return Response.json({ imageUrl: angleData.images[0].url });

      case "generate-video":
        // Generate video from image using kling-video API
        if (!prompt) {
          return Response.json({ error: "Prompt is required for video generation" }, { status: 400 });
        }
        // Duration must be exactly 5 or 10 (enum values for this API)
        const videoDuration = (duration === 5 || duration === 10) ? duration : 5;
        
        result = await fal.subscribe("fal-ai/kling-video/v2.5-turbo/pro/image-to-video", {
          input: {
            image_url: imageUrl,
            prompt: prompt,
            duration: videoDuration,
            negative_prompt: "blur, distort, and low quality",
            cfg_scale: 0.75,
          }
        });
        // Handle both result.data and result directly
        const videoData: any = result.data || result;
        // Extract video URL from response
        // Expected structure: { video: { url: "...", content_type: "video/mp4", ... } }
        const generatedVideoUrl = videoData.video?.url;
        
        if (!generatedVideoUrl) {
          return Response.json({ error: "Failed to extract video URL from response" }, { status: 500 });
        }
        
        // Return both original image URL and generated video URL
        return Response.json({ 
          imageUrl: imageUrl, // Original image URL
          videoUrl: generatedVideoUrl 
        });

      case "convert-to-3d":
        // Convert object to 3D GLB model using SAM-3
        if (!pointPrompts || !Array.isArray(pointPrompts) || pointPrompts.length === 0) {
          return Response.json({ error: "At least one point prompt is required for 3D conversion" }, { status: 400 });
        }

        // Fetch image to get dimensions for coordinate conversion
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const imageMetadata = await sharp(imageBuffer).metadata();
        const imageWidth = imageMetadata.width!;
        const imageHeight = imageMetadata.height!;

        // Convert normalized coordinates (0-1) to pixel coordinates
        const pixelPointPrompts = pointPrompts.map((point: {x: number, y: number, label: 0|1}) => ({
          x: Math.round(point.x * imageWidth),
          y: Math.round(point.y * imageHeight),
          label: point.label as 0 | 1  // Type assertion for API compatibility
        }));

        result = await fal.subscribe("fal-ai/sam-3/3d-objects", {
          input: {
            image_url: imageUrl,
            prompt: prompt || "object",
            point_prompts: pixelPointPrompts as any, // Type casting - API accepts numeric labels but TS types expect strings
            export_textured_glb: true
          } as any // Type casting for export_textured_glb which may not be in TS types yet
        });

        // Handle both result.data and result directly
        const glbData: any = result.data || result;
        const glbUrl = glbData.model_glb?.url;
        
        if (!glbUrl) {
          return Response.json({ error: "Failed to extract GLB URL from response" }, { status: 500 });
        }

        // Return both original image URL and generated GLB URL
        return Response.json({ 
          imageUrl: imageUrl, // Original image URL
          glbUrl: glbUrl 
        });

      case "add-audio":
        if (!videoUrl) {
          return Response.json({ error: "Video URL is required for add-audio" }, { status: 400 });
        }
        if (!prompt) {
          return Response.json({ error: "Prompt is required for add-audio" }, { status: 400 });
        }
        result = await fal.subscribe("fal-ai/mmaudio-v2", {
          input: {
            video_url: videoUrl,
            prompt,
            num_steps: 25,
            duration: 5,
            cfg_strength: 4.5,
          },
        });
        const addAudioData: any = result.data || result;
        const addAudioVideoUrlOut = addAudioData.video?.url;
        if (!addAudioVideoUrlOut) {
          return Response.json({ error: "Failed to extract video URL from add-audio response" }, { status: 500 });
        }
        return Response.json({
          imageUrl: videoUrl,
          videoUrl: addAudioVideoUrlOut,
        });

      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("API Error:", error);
    return Response.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

