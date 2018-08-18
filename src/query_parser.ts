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

import { Queries } from "./uri";
import { isNullOrUndefined } from "./utility";

export class QueryParser<T extends object> {
    private readonly functions: Map<string, MapEntry<any>>;

    public constructor(descriptors: Array<QueryDescriptor<any>>) {
        const withParsers = QueryParser.assertParsers(descriptors);
        const withTargets = QueryParser.assertTargets(withParsers);
        const asPairs = QueryParser.intoPairs(withTargets);

        this.functions = new Map<string, MapEntry<any>>(asPairs);
    }

    public parse(query: Queries, init: T): T {
        const entries = Array.from(this.functions.entries());

        const hasSource = ([source, _entry]: [string, MapEntry<any>]) =>
            !isNullOrUndefined(query[source]);
        const withSources = entries.filter(hasSource);

        const appendParsed = (
            previous: T,
            [source, { target, parser }]: [string, MapEntry<any>]
        ) => {
            // revisit this when TypeScript issue #10727 is implemented
            // https://github.com/Microsoft/TypeScript/issues/10727
            const withParsed = {
                ...previous as object,
                [target]: parser(query[source]!),
            };

            return withParsed as T;
        };

        const doParse = (value: T) => withSources.reduce(appendParsed, value);

        return doParse(init);
    }

    private static assertParsers(
        maybe: Array<QueryDescriptor<any>>
    ): Array<HasParser> {
        return maybe.map((descriptor) => {
            if (!isNullOrUndefined(descriptor.parser)) {
                return descriptor as HasParser;
            }

            const withParser = {
                ...descriptor,
                parser: (raw: string) => raw,
            };

            return withParser as HasParser;
        });
    }

    private static assertTargets(
        maybe: Array<HasParser>
    ): Array<HasTarget> {
        return maybe.map((descriptor) => {
            if (!isNullOrUndefined(descriptor.target)) {
                return descriptor as HasTarget;
            }

            const withTarget = {
                ...descriptor,
                target: descriptor.source,
            };

            return withTarget as HasTarget;
        });
    }

    private static intoPairs(
        descriptors: Array<HasTarget>
    ): Array<[string, MapEntry<any>]> {
        return descriptors.map((descriptor): [string, MapEntry<any>] => [
            descriptor.source,
            { target: descriptor.target, parser: descriptor.parser }
        ]);
    }
}

export interface QueryDescriptor<T> {
    readonly parser?: Parser<T>;
    readonly source: string;
    readonly target?: string;
}

export type Parser<T> = (raw: string | Array<string>) => T;

interface MapEntry<T> {
    readonly parser: Parser<T>;
    readonly target: string;
}

interface HasParser {
    readonly parser: Parser<any>;
    readonly source: string;
    readonly target?: string;
}

interface HasTarget {
    readonly parser: Parser<any>;
    readonly source: string;
    readonly target: string;
}
