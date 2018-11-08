// BSD 3-Clause License
//
// Copyright (c) 2018, IBM Corporation
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

import * as Compressor from "./compressor";
import * as Encoder from "./encoder";
import * as Serializer from "./serializer";

/**
 * encapsulates data transformation for external transmission
 */
export class Packer {
    private compressor: Compressor.Compressor;
    private encoder: Encoder.Encoder;
    private serializer: Serializer.Serializer;

    public constructor({ serializer, compressor, encoder }: Options) {
        this.compressor = compressor;
        this.encoder = encoder;
        this.serializer = serializer;
    }

    /**
     * @param data the data we want pack up for plaintext transmission
     * @returns the packed data
     * @see unpack
     */
    public pack(data: any): string {
        const serialized = this.serializer.serialize(data);
        const compressed = this.compressor.compress(serialized);
        const encoded = this.encoder.encode(compressed);

        return encoded;
    }

    /**
     * @param data the data we want to unpack from plaintext
     * @returns the unpacked data
     * @see pack
     */
    public unpack(packed: string): any {
        const decoded = this.encoder.decode(packed);
        const decompressed = this.compressor.decompress(decoded);
        const deserialized = this.serializer.deserialize(decompressed);

        return deserialized;
    }
}
/**
 * bundles the component objects of a Packer
 */
export interface Options {
    compressor: Compressor.Compressor;
    encoder: Encoder.Encoder;
    serializer: Serializer.Serializer;
}
