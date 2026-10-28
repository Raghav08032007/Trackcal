# Companion artwork prompts and provenance

Built-in image generation tool, 27 October 2026. Original project assets saved under `frontend/web/public/characters/`; no competitor artwork used. Mode: transparent-background generation, with one follow-up edit for Milo.

Each initial prompt used this template, substituting the subject and identity below:

> Use case: stylized-concept. Create one original premium 3D game companion cutout for a nutrition habit app. Subject: SUBJECT. Lifelike dimensional materials, expressive glossy eyes, friendly believable anatomy, beautifully modeled small hands/feet where appropriate. Vibrant saturated colors, cinematic soft studio light and rim light, exquisite texture and depth, polished high-end animated-film realism. Full body centered, three-quarter front view, friendly smile and one raised greeting limb, generous padding around complete silhouette. Transparent background, no floor, no backdrop, no text, no logo, no border. Single character only. Asset identity: ID.

| ID | Subject | Active file |
|---|---|---|
| pip | a vivid lime-green sprouting seed creature, two tender glossy leaves, tiny arms and feet, organic seed skin | pip-v2.png |
| nova | a luminous violet and electric cyan five-pointed star creature, pearlescent surface, tiny feet | nova-v2.png |
| milo | a warm honey-gold baby bear, incredibly detailed soft fur, coral scarf | milo-v3.png |
| luna | a cobalt blue and turquoise baby owl, detailed layered feathers, amber eyes | luna-v2.png |
| rio | a vibrant burnt-orange red fox cub, detailed silky fur, cream muzzle, huge fluffy tail | rio-v2.png |
| sage | an emerald and teal baby turtle, detailed glossy patterned shell, golden accents | sage-v2.png |

Milo edit prompt (input: milo-v2.png):

> Edit target: Milo the golden baby bear. Remove the entire brown studio backdrop and all background glow to genuine alpha transparency. Preserve the exact bear, fine fur edges, red scarf, full body pose, face, paws, lighting and proportions. Output a clean character cutout only, no floor or shadow or background.

All six outputs were visually inspected. These are dimensional raster illustrations with page/CSS motion, not downloadable 3D meshes or skeletal character animations.


## Comic reference follow-up

Built-in image generation, reference input: user-supplied cartoon crew attachment (27 October). Active assets are now `{id}-comic-v1.png` in the same public characters directory. The older rendered assets are preserved as unused variants.

Prompt template:

> Reference image is a style and identity reference. Create a single isolated full-body game character cutout: SUBJECT. Preserve reference species, face, outfit and saturated palette for the referenced character. For the turtle extend the same art style. Bold clean black comic outlines, vibrant flat cel shading, polished modern 2D cartoon sticker artwork, playful dynamic greeting pose, complete head hands feet tail, centered within a square with 12 percent transparent padding. Match line weight and proportions across the collection. No other character, no background, no floor, no text, no watermark, no screenshot UI controls. Genuine transparent background. Character ID ID.

Subjects:

- pip: the yellow-orange spotted monkey at the far left, happy expression, white gloves, colorful red and blue sneakers
- nova: the purple and magenta cyber raccoon second from left, teal visor on forehead, green jacket, orange panels, brown cargo shorts, purple robotic limbs and colorful sneakers
- milo: the central cyan blue lion with huge orange-red mane, brown vest, striped blue shirt, khaki cargo shorts, white gloves and red-blue sneakers
- luna: the lime green spotted leopard second from right, green top, purple shorts, expressive face, high-top colorful sneakers
- rio: the rightmost blue and orange bear-like streetwear animal, backwards purple cap, purple varsity jacket, blue shorts and cream sneakers
- sage: a sixth friendly teal and emerald turtle in the SAME character universe, gold-trimmed shell, bright yellow hoodie, purple shorts and colorful teal sneakers

All assets were inspected before integration. Both themes share these exact images; theme changes only affect the surrounding interface and motion is implemented in CSS.
