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
import * as Packer from "./packer";
import * as Serializer from "./serializer";

/**
 * @param serializer the type of the serializer to use
 * @param compressor the type of the compressor to use
 * @param encoder the type of the encoder to use
 * @returns a Packer that uses the specified serializer, compressor, and encoder
 *
 * @see createDefaultPacker
 */
export const createPacker =
({ serializer, compressor, encoder }: Options): Packer.Packer => {
    const compressorObj = createCompressor(compressor);
    const encoderObj = createEncoder(encoder);
    const serializerObj = createSerializer(serializer);

    return new Packer.Packer({
        compressor: compressorObj,
        encoder: encoderObj,
        serializer: serializerObj,
    });
};

/**
 * creates a Packer with the default serializer, compressor, and encoder
 *
 * @returns a Packer using JSON serialization, no compression, and
 *            Base64 encoding
 *
 * @see createPacker
 */
export const createDefaultPacker = (): Packer.Packer => createPacker({
    compressor: CompressorType.Identity,
    encoder: EncoderType.Base64,
    serializer: SerializerType.Json,
});

/**
 * bundles the component types of a Packer
 */
export interface Options {
    compressor: CompressorType;
    encoder: EncoderType;
    serializer: SerializerType;
}

export enum CompressorType {
    Gzip = "gzip",
    Identity = "identity",
    Zlib = "zlib",
}

export enum EncoderType {
    Base64 = "base64",
    Plaintext = "plaintext",
}

export enum SerializerType {
    Json = "json",
    Yaml = "yaml",
}

/** @ignore */
const createCompressor = (type: CompressorType): Compressor.Compressor => {
    switch (type) {
    case CompressorType.Gzip:
        return Compressor.createGzipCompressor();
    case CompressorType.Identity:
        return Compressor.createIdentityCompressor();
    case CompressorType.Zlib:
        return Compressor.createZlibCompressor();
    }
};

/** @ignore */
const createEncoder = (type: EncoderType): Encoder.Encoder => {
    switch (type) {
    case EncoderType.Base64:
        return Encoder.createBase64Encoder();
    case EncoderType.Plaintext:
        return Encoder.createPlaintextEncoder();
    }
};

/** @ignore */
const createSerializer = (type: SerializerType): Serializer.Serializer => {
    switch (type) {
    case SerializerType.Json:
        return Serializer.createJsonSerializer();
    case SerializerType.Yaml:
        return Serializer.createYamlSerializer();
    }
};
