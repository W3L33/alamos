# Fotos del equipo

Coloca aquí los JPG/PNG de animales del equipo.

## Convención recomendada de nombre

- `pais-animal.jpg` (ej: `china-panda.jpg`, `peru-condor.jpg`)
- o subcarpetas por país (ej: `china/china-panda.jpg`, `mexico/mexico-ajolote.jpg`)

## JSON del equipo

Este directorio debe contener `animals.json` con una entrada por foto:

```json
{
  "photo": "china/china-panda.jpg",
  "globeCountry": "China",
  "animal": "Panda gigante"
}
```

El globo usa `globeCountry` (o `country`) para ubicar el marcador en su país real.

