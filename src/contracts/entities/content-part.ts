/** Text content part */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/** Image URL content part */
export interface ImageContentPart {
  type: 'image_url';
  image_url: { url: string; detail?: 'auto' | 'low' | 'high' };
}

/** Multimodal content — text or image */
export type ContentPart = TextContentPart | ImageContentPart;
