# Атрибуция 3D-моделей

## Z-Anatomy (если используется)

Если `public/models/muscles.glb` собран из Z-Anatomy:

- **Источник:** Z-Anatomy — https://github.com/Z-Anatomy/Models-of-human-anatomy
- **Лицензия:** Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)
  — https://creativecommons.org/licenses/by-sa/4.0/
- **Требования:**
  - Указать авторство (Z-Anatomy) и ссылку на лицензию.
  - Производные модели (наш децимированный glb) распространять под той же
    лицензией CC BY-SA 4.0.
  - Отметить, что внесены изменения (оставлены только мышцы, децимация под веб).

CC BY-SA распространяется на сам ассет (glb), НЕ на код приложения — модель и код
разделены «швом модели» (`lib/avatar/model-config.ts`), исходники SaaS остаются
проприетарными.

Кредит-строку показать в UI рядом с аватаром, например:
«3D-модель на основе Z-Anatomy (CC BY-SA 4.0)».
