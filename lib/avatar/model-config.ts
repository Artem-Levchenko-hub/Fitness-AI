/** Источник 3D-модели аватара — единственный переключатель «шва модели».
 *
 *  null  → рендерим процедурный <PlaceholderBody> (узнаваемая фигура из
 *          примитивов; работает всегда, без ассета).
 *  "/..." → грузим реальный glb через <MuscleModel> (useGLTF + резолвер имён).
 *
 *  Чтобы включить реальную модель (Z-Anatomy Myology): положить glb в
 *  public/models/muscles.glb и поставить здесь "/models/muscles.glb". Раскраска,
 *  тап и вращение уже работают — больше менять ничего не нужно.
 *  См. public/models/README.md. */
export const MUSCLE_MODEL_URL: string | null = null;
