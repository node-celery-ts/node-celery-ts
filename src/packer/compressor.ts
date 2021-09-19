// BSD 3-Clause License
//
// Copyright (c) 2021, node-celery-ts contributors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// * Redistributions of source code must retain the above copyright notice, this
//   list of conditions and the following disclaimer.
//
// * Redistributions in binary form must reproduce the above copyright notice,
//   this list of conditions and the following disclaimer in the documentation
//   and/or other materials provided with the distribution.
//
// * Neither the name of the copyright holder nor the names of its
//   contributors may be used to endorse or promote products derived from
//   this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import * as Zlib from "zlib";

/**
 * encapsulates compression of arbitrary binary data
 */
export interface Compressor {
    compress(buffer: Buffer): Buffer;

    decompress(buffer: Buffer): Buffer;
}

/**
 * @returns a Compressor that returns a copy of its inputs
 */
export const createIdentityCompressor = (): Compressor => ({
    compress: (buffer: Buffer) => Buffer.from(buffer),

    decompress: (buffer: Buffer) => Buffer.from(buffer),
});

/**
 * uses zlib.g{un,}zipSync
 *
 * @returns a Compressor that uses the GZip compression method
 */
export const createGzipCompressor = (): Compressor => ({
    compress: (buffer: Buffer) => Zlib.gzipSync(buffer),

    decompress: (buffer: Buffer) => Zlib.unzipSync(buffer),
});

/**
 * uses zlib.{de,in}flateSync
 *
 * @returns a Compressor that uses the Zlib compression method
 */
export const createZlibCompressor = (): Compressor => ({
    compress: (buffer: Buffer) => Zlib.deflateSync(buffer),

    decompress: (buffer: Buffer) => Zlib.unzipSync(buffer),
});
