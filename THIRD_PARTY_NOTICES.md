# Third-party notices

## Minecraft Web Client

UGN Java uses a build of the open-source Minecraft Web Client maintained by [zardoy](https://github.com/zardoy/minecraft-web-client), forked from [PrismarineJS/prismarine-web-client](https://github.com/PrismarineJS/prismarine-web-client).

Upstream source version is pinned in .github/workflows/deploy-java.yml to commit
`d7ab705efee3af674421c65e62b660ae470cad6b`. The compiled client is placed at `/client/` at deployment time.

The Minecraft Web Client source reports the MIT License:

Copyright (c) 2020 PrismarineJS

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

## Minecraft / Mojang assets and names

The MIT license on client source does **not** grant licenses to Minecraft's trademarks, official game code, assets, resource packs, or user account system. Validate content licensing and Minecraft's usage rules before public release. UGN is an independent fan/community project and is not endorsed by Mojang or Microsoft.

## Multiplayer

The browser cannot open a direct Java TCP connection. Multiplayer requires a separately deployed, access-controlled WebSocket-to-TCP proxy and a compatible Minecraft Java server. This repository does not bundle one or collect Microsoft passwords.
