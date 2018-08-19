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
import { isNullOrUndefined, parseBoolean, parseInteger } from "./utility";

import * as Fs from "fs";

/**
 * `QueryParser` handles URI query parsing and transformation.
 * Users define the source property name and optionally the target property
 * name and a parsing function.
 */
export class QueryParser<T extends object> {
    private readonly functions: Map<string, MapEntry<any>>;

    /**
     * @param descriptors The mappings of URI query entries.
     * @returns A `QueryParser` that is ready to parse URI queries.
     */
    public constructor(descriptors: Array<QueryDescriptor<any>>) {
        const withParsers = QueryParser.assertParsers(descriptors);
        const withTargets = QueryParser.assertTargets(withParsers);
        const asPairs = QueryParser.intoPairs(withTargets);

        this.functions = new Map<string, MapEntry<any>>(asPairs);
    }

    /**
     * Checks that `query` contains each of the possible fields, then
     * invokes the associated `Parser` and appends the result to a copy of
     * `init`.
     *
     * @param query The URI query object to parse.
     * @param init The initial state of a mapped object before reducing with
     *             the map functions. Might be used to provide required
     *             parameters.
     * @returns A `T` with all available queries mapped from `query`.
     *
     * @throws Error If any of the query parsers throw.
     */
    public parse(query: Queries, init: T): T {
        const entries = Array.from(this.functions.entries());

        const hasSource = createSourceChecker<T>(query);
        const withSources = entries.filter(hasSource);

        const appendParsed = createParsedAppender<T>(query);
        const doParse = (value: T) => withSources.reduce(appendParsed, value);

        try {
            return doParse(init);
        } catch (error) {
            throw new Error(`query parsing failed: ${error}`);
        }
    }

    /**
     * @param maybe `QueryDescriptor`s that might not have a `parser`.
     * @returns A copy of `maybe` coerced into a `HasParser` by defaulting an
     *          identity parser.
     */
    private static assertParsers(
        maybe: Array<QueryDescriptor<any>>
    ): Array<HasParser> {
        return maybe.map((descriptor) => {
            const withParser = {
                parser: (raw: string) => raw,
                ...descriptor,
            };

            return withParser as HasParser;
        });
    }

    /**
     * @param maybe `HasTarget`s that might not have a `target`.
     * @returns A copy of `maybe` coerced into a `HasTarget` by defaulting
     *          `target` as the source property.
     */
    private static assertTargets(
        maybe: Array<HasParser>
    ): Array<HasTarget> {
        return maybe.map((descriptor) => {
            const withTarget = {
                target: descriptor.source,
                ...descriptor,
            };

            return withTarget as HasTarget;
        });
    }

    /**
     * @param descriptors An array of fully non-undefined `QueryDescriptor`s.
     * @returns An array of pairs of `[source, { target, parser }]` for creating
     *          a `Map`.
     */
    private static intoPairs(
        descriptors: Array<HasTarget>
    ): Array<[string, MapEntry<any>]> {
        return descriptors.map((descriptor): [string, MapEntry<any>] => [
            descriptor.source,
            { target: descriptor.target, parser: descriptor.parser }
        ]);
    }
}

/**
 * Description of a URI query key-value pair and how to parse it into a target
 * type.
 */
export interface QueryDescriptor<T> {
    readonly parser?: Parser<T>;
    readonly source: string;
    readonly target?: string;
}

export type Parser<T> = (raw: string | Array<string>) => T;

/**
 * If multiple values are provided, the last one provided is used.
 *
 * @param source The property name to map from.
 * @param target The property name to map into. Defaults to `source`.
 * @returns A `QueryDescriptor` that transforms to a `boolean`.
 */
export const createBooleanQueryDescriptor = (
    source: string,
    target?: string
): QueryDescriptor<boolean> => ({
    parser: (x) => parseBoolean(asScalar(x)),
    source,
    target,
});

/**
 * If multiple values are provided, the last one provided is used.
 *
 * @param source The property name to map from.
 * @param target The property name to map into. Defaults to `source`.
 * @returns A `QueryDescriptor` that transforms to a `number`.
 */
export const createIntegerQueryDescriptor = (
    source: string,
    target?: string
): QueryDescriptor<number> => ({
    parser: (x) => parseInteger(asScalar(x)),
    source,
    target,
});

/**
 * Interprets the values as paths, then reads it into a buffer with
 * `Fs.readFileSync`.
 *
 * @param source The property name to map from.
 * @param target The property name to map into. Defaults to `source`.
 * @returns A `QueryDescriptor` that transforms into an `Array<Buffer>`.
 */
export const createPathArrayQueryDescriptor = (
    source: string,
    target?: string
): QueryDescriptor<Array<Buffer>> => ({
    parser: (x) => asArray(x).map((p) => Fs.readFileSync(p)),
    source,
    target,
});

/**
 * Interprets the value as a path, then reads from each path's corresponding
 * file using `Fs.readFileSync`. If multiple values are provided, the last one
 * provided is used.
 *
 * @param source The property name to map from.
 * @param target The property name to map into. Defaults to `source`.
 * @returns A `QueryDescriptor` that maps to a `Buffer`.
 */
export const createPathQueryDescriptor = (
    source: string,
    target?: string
): QueryDescriptor<Buffer> => ({
    parser: (x) => Fs.readFileSync(asScalar(x)),
    source,
    target,
});

/**
 * If `scalarOrArray` is an `Array`, it cannot be empty.
 *
 * @param scalarOrArray A value to assert as a scalar.
 * @returns If `scalarOrArray` is a scalar, `scalarOrArray`. If `scalarOrArray`
 *          is an `Array`, `scalarOrArray[scalarOrArray.length - 1]`.
 */
export const asScalar = <T>(scalarOrArray: T | Array<T>): T => {
    if (scalarOrArray instanceof Array) {
        const array: Array<T> = scalarOrArray;

        return array[array.length - 1];
    }

    const scalar = scalarOrArray;

    return scalar;
};

/**
 * @param scalarOrArray A value to assert as an `Array`.
 * @returns If `scalarOrArray` is a scalar, `[scalarOrArray]`. If
 *          `scalarOrArray` is an `Array`, `scalarOrArray`.
 */
export const asArray = <T>(scalarOrArray: T | Array<T>): Array<T> => {
    if (scalarOrArray instanceof Array) {
        const array = scalarOrArray;

        return array;
    }

    const scalar = scalarOrArray;

    return [scalar];
};

/**
 * An entry in `QueryParser`'s internal `Map`.
 */
interface MapEntry<T> {
    readonly parser: Parser<T>;
    readonly target: string;
}

/**
 * A `QueryDescriptor<any>` that is guaranteed to have the `parser` property.
 */
interface HasParser {
    readonly parser: Parser<any>;
    readonly source: string;
    readonly target?: string;
}

/**
 * A `QueryDescriptor<any>` that is guaranteed to have the `parser` and `target`
 * properties.
 */
interface HasTarget {
    readonly parser: Parser<any>;
    readonly source: string;
    readonly target: string;
}

/**
 * @param query The URI query object to check for source presence.
 * @returns A function that can be used to filter a collection of
 *          `Map<string, MapEntry<T>>` entries into only entries that have
 *          matching `query[source]` parameters.
 */
const createSourceChecker = <T>(query: Queries) => ([source, _]: [
    string,
    MapEntry<T>
]) => !isNullOrUndefined(query[source]);

/**
 * @param query A URI query object that has the property `[source]`.
 * @returns A function that can be invoked to append a parsed value from `query`
 *          to a copy of `previous`.
 */
const createParsedAppender = <T extends object>(query: Queries) => (
    previous: T,
    [source, { target, parser }]: [string, MapEntry<any>]
): T => {
    // revisit this when TypeScript issue #10727 is implemented
    // https://github.com/Microsoft/TypeScript/issues/10727
    const withParsed = {
        ...previous as object,
        [target]: parser(query[source]!),
    };

    return withParsed as T;
};
