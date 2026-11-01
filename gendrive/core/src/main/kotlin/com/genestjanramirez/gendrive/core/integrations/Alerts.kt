package com.genestjanramirez.gendrive.core.integrations

import com.genestjanramirez.gendrive.core.trip.ChargeSession
import com.genestjanramirez.gendrive.core.trip.CostSettings
import com.genestjanramirez.gendrive.core.trip.EnergyMath
import com.genestjanramirez.gendrive.core.trip.Trip
import kotlin.math.roundToInt

/**
 * A thing worth telling the owner's phone about. The Android side raises these
 * from the same places that already drive spoken warnings (trip end, charging
 * done, low battery, low tyre) and sends them on with [TelegramAlerts].
 *
 * [Message] is the open slot for events that need car data GenDrive cannot read
 * yet (a door left open, a window down, a sentry trigger); once those readings
 * are wired on the car, they become alerts without touching the transport.
 */
sealed interface CarAlert {
    data class TripFinished(val trip: Trip) : CarAlert
    data class ChargingFinished(val session: ChargeSession) : CarAlert
    data class LowBattery(val socPercent: Int, val rangeKm: Int?) : CarAlert
    data class LowTyre(val kpa: Double) : CarAlert
    data class Message(val title: String, val body: String = "") : CarAlert
}

/**
 * Formats [CarAlert]s as Telegram messages and builds the Bot API send URL.
 * Pure and tested; the Android side owns the HTTP GET. The owner creates a bot
 * with @BotFather, pastes the token and their chat id into Settings.
 */
object TelegramAlerts {
    const val API = "https://api.telegram.org"

    fun format(alert: CarAlert, cost: CostSettings): String = when (alert) {
        is CarAlert.TripFinished -> {
            val t = alert.trip
            val parts = mutableListOf("${oneDp(t.distanceKm)} km")
            t.consumptionKwhPer100()?.let { parts += "${oneDp(it)} kWh/100km" }
            t.energyKwh?.takeIf { it > 0 }?.let { kwh ->
                val spent = EnergyMath.electricityCost(kwh, cost.pricePerKwh, cost.chargingLossPct)
                val saved = EnergyMath.petrolCost(t.distanceKm, cost.petrolLitresPer100Km, cost.petrolPricePerLitre) - spent
                parts += money(spent, cost)
                if (saved > 1) parts += "saved ${money(saved, cost)} vs petrol"
            }
            "🚗 Trip complete\n" + parts.joinToString(" · ")
        }
        is CarAlert.ChargingFinished -> {
            val s = alert.session
            val spent = EnergyMath.electricityCost(s.energyKwh, cost.pricePerKwh, cost.chargingLossPct)
            val soc = s.endSoc?.let { " · battery ${it.roundToInt()}%" } ?: ""
            "🔌 Charging finished\n${oneDp(s.energyKwh)} kWh added · ${money(spent, cost)}$soc"
        }
        is CarAlert.LowBattery -> {
            val left = alert.rangeKm?.let { "\nAbout $it km left." } ?: ""
            "🪫 Battery low: ${alert.socPercent}%$left"
        }
        is CarAlert.LowTyre ->
            "🛠 Tyre pressure low: ${alert.kpa.roundToInt()} kPa (${(alert.kpa / 6.895).roundToInt()} psi)"
        is CarAlert.Message ->
            if (alert.body.isBlank()) alert.title else "${alert.title}\n${alert.body}"
    }

    /** The Telegram Bot API sendMessage URL. The token keeps its colon; only values are encoded. */
    fun sendUrl(botToken: String, chatId: String, text: String): String =
        "$API/bot$botToken/sendMessage" +
            "?chat_id=${Http.percentEncode(chatId)}" +
            "&disable_web_page_preview=true" +
            "&text=${Http.percentEncode(text)}"

    private fun money(v: Double, cost: CostSettings): String = "${cost.currency}${v.roundToInt()}"

    private fun oneDp(v: Double): String {
        val r = (v * 10).roundToInt()
        return "${r / 10}.${r % 10}"
    }
}
