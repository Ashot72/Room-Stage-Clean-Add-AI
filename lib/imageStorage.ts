export interface StoredImage {
  id: string;
  url: string; // fal.storage URL
  type: 'original' | 'cleaned' | 'staged' | 'reference' | 'added' | 'angled' | 'video' | '3d-object' | 'canva';
  timestamp: number;
  videoUrl?: string; // URL of generated video (for type 'video')
  glbUrl?: string; // URL of generated GLB file (for type '3d-object')
  sourceImageId?: string; // ID of source image used to generate derived content
  metadata?: {
    prompt?: string;
    selection?: Array<{
      x: number;
      y: number;
    }>;
    hasAudio?: boolean; // true when video was generated with add-audio (MMAudio)
    // Canva metadata (optional)
    canvaDesignId?: string;
    canvaCorrelationState?: string;
  };
}

const STORAGE_KEY = 'spacemesh_images';
const SELECTIONS_KEY = 'spacemesh_selections';

export async function uploadToFalStorage(file: File): Promise<string> {
  try {
    // Upload via API route to keep credentials server-side
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload image')
    }

    const data = await response.json()
    return data.url
  } catch (error) {
    console.error('Failed to upload to fal.storage:', error)
    throw new Error('Failed to upload image')
  }
}

export function saveImage(image: Omit<StoredImage, 'id' | 'timestamp'>): StoredImage {
  const storedImage: StoredImage = {
    ...image,
    id: generateId(),
    timestamp: Date.now(),
  };

  const images = loadAllImages();
  images.unshift(storedImage); // Add to beginning to maintain newest-first order
  localStorage.setItem(STORAGE_KEY, JSON.stringify(images));

  return storedImage;
}

export function loadAllImages(): StoredImage[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const images = data ? JSON.parse(data) : [];
    return images;
  } catch (error) {
    console.error('Failed to load images from localStorage:', error);
    return [];
  }
}

export function deleteImage(imageId: string): boolean {
  try {
    const images = loadAllImages();
    const filtered = images.filter(img => img.id !== imageId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    return true;
  } catch (error) {
    console.error('Failed to delete image from localStorage:', error);
    return false;
  }
}

export function getImageById(imageId: string): StoredImage | null {
  const images = loadAllImages();
  return images.find(img => img.id === imageId) || null;
}

export function updateImage(imageId: string, updates: Partial<Omit<StoredImage, 'id' | 'timestamp'>>): StoredImage | null {
  try {
    const images = loadAllImages();
    const index = images.findIndex(img => img.id === imageId);
    if (index === -1) return null;
    const updated = { ...images[index], ...updates } as StoredImage;
    images[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
    return updated;
  } catch (error) {
    console.error('Failed to update image in localStorage:', error);
    return null;
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface SelectionState {
  selectedBefore: string | null;
  selectedAfter: string | null;
  selectedForClean: string | null;
  selectedForStaging: string | null;
  selectedForAddItem: string | null;
  selectedForView: string | null;
  selectedForDifferentAngles: string | null;
  selectedForVideo: string | null;
  selectedForConvertTo3d: string | null;
  selectedForAddAudio: string | null;
}

export function saveSelections(selections: SelectionState): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(SELECTIONS_KEY, JSON.stringify(selections));
  } catch (error) {
    console.error('Failed to save selections to localStorage:', error);
  }
}

export function loadSelections(): SelectionState {
  if (typeof window === 'undefined') {
    return {
      selectedBefore: null,
      selectedAfter: null,
      selectedForClean: null,
      selectedForStaging: null,
      selectedForAddItem: null,
      selectedForView: null,
      selectedForDifferentAngles: null,
      selectedForVideo: null,
      selectedForConvertTo3d: null,
      selectedForAddAudio: null,
    };
  }
  
  try {
    const data = localStorage.getItem(SELECTIONS_KEY);
    const selections = data ? JSON.parse(data) : {
      selectedBefore: null,
      selectedAfter: null,
      selectedForClean: null,
      selectedForStaging: null,
      selectedForAddItem: null,
      selectedForView: null,
      selectedForDifferentAngles: null,
      selectedForVideo: null,
      selectedForConvertTo3d: null,
      selectedForAddAudio: null,
    };
    // Ensure backward compatibility
    if (!selections.hasOwnProperty('selectedForAddItem')) {
      selections.selectedForAddItem = null;
    }
    if (!selections.hasOwnProperty('selectedForView')) {
      selections.selectedForView = null;
    }
    if (!selections.hasOwnProperty('selectedForDifferentAngles')) {
      selections.selectedForDifferentAngles = null;
    }
    if (!selections.hasOwnProperty('selectedForVideo')) {
      selections.selectedForVideo = null;
    }
    if (!selections.hasOwnProperty('selectedForConvertTo3d')) {
      selections.selectedForConvertTo3d = null;
    }
    if (!selections.hasOwnProperty('selectedForAddAudio')) {
      selections.selectedForAddAudio = null;
    }
    return selections;
  } catch (error) {
    console.error('Failed to load selections from localStorage:', error);
    return {
      selectedBefore: null,
      selectedAfter: null,
      selectedForClean: null,
      selectedForStaging: null,
      selectedForAddItem: null,
      selectedForView: null,
      selectedForDifferentAngles: null,
      selectedForVideo: null,
      selectedForConvertTo3d: null,
      selectedForAddAudio: null,
    };
  }
}

