package com.genestjanramirez.gendrive.core.integrations

/** Shared, dependency-free URL helpers so the integrations need no Android classes. */
internal object Http {
    private const val SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~"
    private const val HEX = "0123456789ABCDEF"

    /** RFC 3986 percent-encoding of one component (query value or token). */
    fun percentEncode(raw: String): String {
        val sb = StringBuilder(raw.length * 2)
        for (b in raw.encodeToByteArray()) {
            val c = b.toInt() and 0xFF
            if (c.toChar() in SAFE) sb.append(c.toChar())
            else sb.append('%').append(HEX[c shr 4]).append(HEX[c and 0x0F])
        }
        return sb.toString()
    }
}
