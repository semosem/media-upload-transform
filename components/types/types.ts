export type CloudinaryAsset = {
  public_id: string;
  asset_id?: string;
  secure_url: string;
  resource_type: string;
  format?: string;
  duration?: number;
  width?: number;
  height?: number;
  created_at?: string;
};

export type QuickLook = {
  label: string;
  filter: string;
  description: string;
  vignette?: boolean;
};

export type GradeSettings = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
};

export type TimelineClip = {
  label: string;
  color: string;
};

export type InspectorSettingId = "sharpness" | "noise" | "stabilize" | "grain";

export type InspectorSetting = {
  id: InspectorSettingId;
  label: string;
  value: number;
  min?: number;
  max?: number;
};
