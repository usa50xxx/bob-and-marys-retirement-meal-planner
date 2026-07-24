# Third-party notices

Bob and Mary's Retirement Meal Planner includes open-source software. The full
license texts shipped with the browser components remain in the `vendor`
directory of each release package.

## Runtime components

- Capacitor Core and Capacitor Android, copyright Ionic, are distributed under
  the MIT License. The required license text follows.
- PDF.js, copyright Mozilla Foundation, is distributed under the Apache License
  2.0. Its license is included at `vendor/pdfjs/LICENSE.txt`.
- Tesseract.js and the bundled Tesseract WebAssembly core are distributed under
  the Apache License 2.0. Their licenses are included under
  `vendor/tesseract`.
- The bundled English Tesseract trained-data file is distributed under the
  Apache License 2.0.

## Development-only components

The repository also uses pdf-lib (MIT), Playwright (Apache-2.0), sharp
(Apache-2.0), and esbuild (MIT) to create test fixtures, test the app, optimize
images, and prepare Android 7-compatible scripts. These packages are
development tools and are not copied into the portable website or Android web
bundle.

## Food images

Ingredient image rights are tracked separately. A signed public release is
blocked until every bundled image has a complete source, author, license, and
license link approved for redistribution. See the repository's
[image provenance audit](https://github.com/usa50xxx/bob-and-marys-retirement-meal-planner/blob/main/docs/IMAGE_PROVENANCE_AUDIT.md)
for the current status.

## Capacitor MIT License

Copyright (c) 2017-present Drifty Co.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
