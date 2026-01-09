export interface PresetModel {
  id: string;
  name: string;
  thumbnail: string;
  objUrl: string;
}

export const PRESET_MODELS: PresetModel[] = [
  {
    id: 'fullbody-01',
    name: 'Default Body 01',
    thumbnail: '/images/FullBody01.jpg',
    objUrl: '/models/FullBody01_body_0.obj',
  },
  {
    id: 'fullbody-02',
    name: 'Default Body 02',
    thumbnail: '/images/FullBody02.jpg',
    objUrl: '/models/FullBody02_body_0.obj',
  },
];

