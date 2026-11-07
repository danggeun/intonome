/**
 * 앱에 실린 글꼴·라이브러리의 라이선스 고지 — 설정 › 오픈소스 라이선스 화면이 그대로 보여 준다. ui 에 두는 이유: 법률 문서 본문에 "document" 같은 낱말이 있어 core 의 브라우저 API 검사에 걸린다.
 * 글꼴(SIL OFL 1.1)은 배포할 때 저작권 고지와 라이선스 전문이 함께 가야 한다. 영문 법률 문서라 번역하지 않는다
 */
export const APP_LICENSE = `Intonome
MIT License
Copyright (c) 2026 Yeonho (danggeun)
https://github.com/danggeun/intonome`

/** 각 항목: 이름 · 쓰임 · 저작권 고지 · 라이선스 종류 */
export const NOTICES: ReadonlyArray<{ name: string; use: string; copyright: string; license: 'OFL' | 'MIT' }> = [
  { name: 'DM Mono', use: 'Numbers and note names', copyright: 'Copyright 2020 The DM Mono Project Authors (https://www.github.com/googlefonts/dm-mono)', license: 'OFL' },
  { name: 'Bravura', use: 'Note glyphs in the metronome, traced as outlines (scripts/gen-note-glyphs.py)', copyright: 'Copyright \u00a9 2019, Steinberg Media Technologies GmbH (http://www.steinberg.net/), with Reserved Font Name "Bravura".', license: 'OFL' },
  { name: 'Bricolage Grotesque', use: 'The Intonome wordmark, embedded as outlines', copyright: 'Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage)', license: 'OFL' },
  { name: 'Capacitor (@capacitor/core, android, app, filesystem, haptics, share, status-bar, text-zoom)', use: 'Android app shell', copyright: 'Copyright (c) 2017-present Drifty Co.', license: 'MIT' },
  { name: 'Workbox', use: 'Offline cache (service worker)', copyright: 'Copyright 2018 Google LLC', license: 'MIT' },
]

export const OFL_TEXT = `------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.`

export const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`

/** 화면에 보일 전문 하나 — 고지 목록 뒤에 라이선스 전문(OFL · MIT)을 한 번씩 */
export function licensesText(): string {
  const items = NOTICES.map(n => `${n.name}\n${n.use}\n${n.copyright}\nLicense: ${n.license === 'OFL' ? 'SIL Open Font License 1.1' : 'MIT License'}`).join('\n\n')
  return `${APP_LICENSE}\n\n${items}\n\n\n${OFL_TEXT}\n\n\n------------------------------------\nMIT License\n------------------------------------\n\n${MIT_TEXT}`
}
