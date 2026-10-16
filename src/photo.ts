import { MAX_PHOTO_BYTES, MAX_SOURCE_PHOTO_BYTES, PHOTO_SIDE, PHOTO_DATA_PREFIX } from './photo-limits';
export { MAX_PHOTO_BYTES, MAX_SOURCE_PHOTO_BYTES, PHOTO_SIDE, PHOTO_DATA_PREFIX } from './photo-limits';
const SOURCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function checkPhotoFile(file: Pick<File, 'size' | 'type'>): void {
  if (!SOURCE_TYPES.has(file.type)) throw new Error('Оберіть фото у форматі JPG, PNG або WebP.');
  if (!file.size) throw new Error('Цей файл порожній. Оберіть інше фото.');
  if (file.size > MAX_SOURCE_PHOTO_BYTES) throw new Error('Фото завелике. Максимальний розмір — 10 МБ.');
}

export async function preparePhoto(file: File): Promise<string> {
  checkPhotoFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error('Не вдалося відкрити фото. Спробуйте інший файл JPG, PNG або WebP.'); });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error('Не вдалося визначити розмір фото.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(PHOTO_SIDE, side);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Браузер не підтримує підготовку фото.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, (image.naturalWidth-side)/2, (image.naturalHeight-side)/2, side, side, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.8, 0.65, 0.5]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.startsWith(PHOTO_DATA_PREFIX) && (data.length-PHOTO_DATA_PREFIX.length)*3/4 <= MAX_PHOTO_BYTES) return data;
    }
    throw new Error('Не вдалося зменшити це фото. Спробуйте інший файл.');
  } finally { URL.revokeObjectURL(url); }
}
