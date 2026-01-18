#### 🚀 AI-Powered Interior Photo Editing for Cleaning, Staging & Adding Items

The app is a real estate image editing application that uses advanced AI models to transform interior photos. It lets you clean unwanted objects, stage rooms in different styles, and add furniture or décor with just a few clicks or prompts. The app makes creating high-quality, photorealistic room visuals fast, intuitive, and perfect for real estate listings or interior design mockups.

#### ✨Enhanced with Multiple Angles and Video Generation

Users can generate new views from any camera angle and create dynamic videos from static images. It offers full control over azimuth (horizontal rotation), elevation (vertical angle), and zoom (camera distance), allowing realistic visualizations from floor-level, eye-level, or top-down perspectives. Videos can then be generated with smooth motion, perfect for virtual walkthroughs, interior design, or real estate presentations.

---

### Features 🚀

#### 1. Upload & Manage Images 📸
- Upload room photos and automatically store them in `fal.storage`.
- All images are saved in `localStorage`, so your work persists even after refreshing the page.
- Thumbnail strip at the bottom shows all originals, cleaned versions, staged rooms, and added items.
- Hover to preview, right-click for options: set for operations, download, or delete.

#### 2. Cleaning Mode 🖌️❌
- Remove unwanted objects with two methods:  
  1. **Prompt Mode** – simply type what to remove (e.g., "remove old sofa").  
  2. **Polygon Selection** – draw a polygon around the object for precise removal.
- After processing, compare before/after images side-by-side or with a slider.

#### 3. Staging Mode 🎨🛋️
- Transform empty rooms into fully furnished spaces with style presets:  
  - Industrial  
  - Scandinavian  
  - Mid-Century  
  - Bohemian  
  - Art Deco
- Modify presets or write custom prompts.
- Uses specialized interior design models to generate photorealistic staged rooms.

#### 4. Adding Items 🏺📸
- Add new items with:  
  1. **Prompt only** – e.g., "add a blue sofa".  
  2. **Prompt + Reference Image** – guides AI to match the reference.
- Supports polygon selection for precise placement.

#### 5. Multiple Angles & Camera Control 🔄📐
Generate new views of a room from different camera positions using a single image.  
Control **azimuth** (horizontal rotation), **elevation** (vertical angle), and **zoom** (camera distance) to visualize spaces from floor-level, eye-level, or top-down perspectives.

#### 6. Video Generation 🎥✨
Convert static room images into smooth, immersive videos.  
Use simple text prompts such as *“360-degree rotation”* or *“slow pan across the room”*, and select a duration of 5 or 10 seconds to create realistic walkthroughs, virtual tours, or dynamic presentations.

---

#### 👉 Links & Resources

- [Fal.ai Homepage](https://fal.ai/)  
- [Apartment Staging Model](https://fal.ai/models/fal-ai/flux-2-lora-gallery/apartment-staging)  
- [Object Removal Model](https://fal.ai/models/fal-ai/object-removal)  
- [Object Removal Mask Model](https://fal.ai/models/fal-ai/object-removal/mask)  
- [Inpaint Model](https://fal.ai/models/fal-ai/flux-kontext-lora/inpaint)  
- [Fill Model](https://fal.ai/models/fal-ai/flux-pro/v1/fill) 
- [Multiple Angles Model](https://fal.ai/models/fal-ai/qwen-image-edit-2511-multiple-angles) 
- [Image to Video Model](https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video)  
---

#### 🚀 Clone and Run

```bash
# Clone the repository
git clone https://github.com/Ashot72/Room-Stage-Clean-Add-AI

# Navigate into the project directory
cd Room-Stage-Clean-Add-AI

# Copy .env.local,example to create a new .env.local file, then add your FAL_KEY.
cp env.local.example .env.local

# Install dependencies
npm install

# Start the development server
npm run dev

# The app will be available at http://localhost:3000
```
#### 🛠 Debugging in VS Code

- Open the **Run** view (`View → Run` or `Ctrl+Shift+D`) to access the debug configuration

📺 **Video: (Cleaning, Staging & Adding Items)** [Watch on YouTube](https://youtu.be/yqsgr9Z5MJo)

📺 **Video: (Multiple Angles and Video Generation)** [Watch on YouTube](https://youtu.be/DKne0nvZxJA) 