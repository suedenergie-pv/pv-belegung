"""PDF-Inter aus der vorhandenen Webschrift erzeugen (fonttools + brotli).

Aufruf vom Repository-Root: python scripts/build-pdf-font.py
Keine Netzwerkquelle; Lizenz: apps/web/app/fonts/LICENSE.txt.
"""
from pathlib import Path
import base64
from io import BytesIO
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

root = Path(__file__).resolve().parent.parent
source = root / 'apps/web/app/fonts/InterVariable.woff2'
parts = ['// Generiert aus app/fonts/InterVariable.woff2 (OFL, siehe dortige LICENSE.txt).',
         '// Statische Schnitte 400/700; reproduzierbar mit scripts/build-pdf-font.py.']
for name, weight in [('REGULAR', 400), ('BOLD', 700)]:
    font = TTFont(source)
    axes = {axis.axisTag: (weight if axis.axisTag == 'wght' else axis.defaultValue)
            for axis in font['fvar'].axes}
    font = instantiateVariableFont(font, axes, inplace=True)
    options = subset.Options()
    options.name_IDs = ['*']
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=list(range(0x20, 0x250)) + list(range(0x1E00, 0x2070)) + [0x20AC, 0x2122])
    sub.subset(font)
    font.flavor = None
    out = BytesIO()
    font.save(out)
    parts.append(f"export const INTER_{name} = '{base64.b64encode(out.getvalue()).decode()}';")
(root / 'apps/web/lib/pdf-font-data.ts').write_text('\n'.join(parts) + '\n', encoding='utf-8')
