# Атрибуция 3D-моделей

## muscles.glb — Z-Anatomy «Myology» (АКТИВНА)

`public/models/muscles.glb` собран из Sketchfab-выгрузки Z-Anatomy «Myology».
Обязательная кредит-строка (показывается в UI под аватаром, см.
`components/avatar/ProfileAvatar.tsx`):

> This work is based on "Myology"
> (https://sketchfab.com/3d-models/myology-31b40fd809b14665b93773936d67c52c)
> by Z-Anatomy (https://sketchfab.com/Z-Anatomy) licensed under CC-BY-SA-4.0
> (http://creativecommons.org/licenses/by-sa/4.0/)

Изменения: оставлены только мышцы (LINES-аннотации убраны), геометрия упрощена
(meshopt) и сжата (draco), меши сгруппированы в 14 групп по пространственному
центроиду (`scripts/build-avatar-glb.mjs`). Производная распространяется под той
же CC BY-SA 4.0.

## Общие требования Z-Anatomy

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
