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

import {
    BasicRedisSentinelOptions as Options,
    RedisSentinelAuthority as Authority,
} from "../basic_options";

import { ParseError } from "../../errors";
import { asScalar, QueryParser } from "../../query_parser";
import { getScheme, parseUri, Scheme, Uri } from "../../uri";
import { isNullOrUndefined } from "../../utility";

/**
 * The URI should be formatted as follows:
 * sentinel://host:port[;sentinel://host:port...]
 * Any one of the URIs can have `name` or `role` specified in their query. The
 * last query values will be used. `name` is the name of the master to connect
 * to and must be specified. `role` determines the specific node from the
 * Sentinel group that is connected to. Must be either `"master"` or `"slave"`.
 *
 * @param rawUri The URI to parse.
 * @returns `Options` parsed from `rawUri`.
 *
 * @throws ParseError If `rawUri` is not a valid semicolon-delimited list of
 *                    Sentinel URIs.
 */
export const parseSentinelUri = (rawUris: string): Options => {
    const split = rawUris.split(";");

    const parsed = split.map(parseIndividual);
    const sentinels = parsed.map(([sentinel, _]) => sentinel);
    const individualOptions = parsed.map(([_, query]) => query);

    const options = individualOptions.reduce(
        (lhs, rhs) => ({ ...lhs, ...rhs })
    );

    if (isNullOrUndefined(options.name)) {
        throw new ParseError("sentinel options missing name");
    }

    return {
        ...options as StrongSentinelQueries,
        protocol: "sentinel",
        sentinels,
    };
};

/**
 * Weak Sentinel queries - not guaranteed to contain necessary queries for a
 * Sentinel client.
 */
interface SentinelQueries {
    name?: string;
    role?: "master" | "slave";
}

/**
 * Strong Sentinel queries - guaranteed to contain necessary queries for the
 * construction of a Sentinel client.
 */
interface StrongSentinelQueries {
    name: string;
    role?: "master" | "slave";
}

/**
 * @param rawUri A single Sentinel URI to parse.
 * @returns The authority and queries of a Sentinel URI.
 *
 * @throws ParseError if the URI is not a valid Sentinel URI.
 */
const parseIndividual = (
    rawUri: string
): [Authority, SentinelQueries] => {
    const uri = parseUri(rawUri);

    const authority = parseAuthority(uri);
    const queries = parseQueries(uri);

    return [authority, queries];
};

/**
 * @param uri The object representation of a URI to verify.
 * @returns The flattened and verified authority of `uri`.
 *
 * @throws ParseError If `uri` is not a Sentinel URI or it is lacking a
 *                    hostname and port number.
 */
const parseAuthority = (uri: Uri): Authority => {
    const scheme = getScheme(uri.raw);

    if (!isSentinelScheme(scheme)) {
        throw new ParseError(`URI ${uri.raw} is not a sentinel URI.`);
    } else if (isNullOrUndefined(uri.authority)) {
        throw new ParseError(`URI ${uri.raw} is missing its authority.`);
    } else if (isNullOrUndefined(uri.authority.port)) {
        throw new ParseError(`URI "${uri.raw}" is missing a port.`);
    }

    return {
        host: uri.authority.host,
        port: uri.authority.port,
    };
};

/**
 * @param uri The object representation of a URI to extract queries from.
 * @returns The parsed queries from `uri`.
 *
 * @throws ParseError If `uri` contains an invalid `role` query.
 */
const parseQueries = (uri: Uri): SentinelQueries => {
    if (isNullOrUndefined(uri.query)) {
        return { };
    }

    const rawQuery = uri.query;

    const parser = new QueryParser<SentinelQueries>([
        { source: "name" },
        { parser: (x) => parseRole(asScalar(x)), source: "role" },
    ]);

    return parser.parse(rawQuery, { });
};

/**
 * Valid schemes are `sentinel` and `sentinels` (secure).
 *
 * @param scheme A `Scheme` to validate.
 * @returns True if `scheme` is a Sentinel or Sentinel Secure scheme.
 */
const isSentinelScheme = (scheme: Scheme): boolean =>
    scheme === Scheme.RedisSentinel || scheme === Scheme.RedisSentinelSecure;

/**
 * @param role A string that should be `"master" | "slave"`.
 * @returns `role`.
 *
 * @throws ParseError If `role` is not `master` or `slave`.
 */
const parseRole = (role: string): "master" | "slave" => {
    if (role !== "master" && role !== "slave") {
        throw new ParseError(`role "${role}" is not "master" or "slave"`);
    }

    return role;
};
