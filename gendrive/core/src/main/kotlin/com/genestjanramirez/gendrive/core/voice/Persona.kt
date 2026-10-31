package com.genestjanramirez.gendrive.core.voice

import com.genestjanramirez.gendrive.core.trip.ChargeSession
import com.genestjanramirez.gendrive.core.trip.CostSettings
import com.genestjanramirez.gendrive.core.trip.EnergyMath
import com.genestjanramirez.gendrive.core.trip.Trip
import com.genestjanramirez.gendrive.core.vehicle.DistanceUnit
import com.genestjanramirez.gendrive.core.vehicle.PressureUnit
import com.genestjanramirez.gendrive.core.vehicle.Units
import com.genestjanramirez.gendrive.core.vehicle.VehicleState
import java.util.Locale
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * Gen's lines: a calm, refined British assistant with dry, understated wit.
 * An original character in the spirit of a film butler-AI, not a copy of one.
 * Everything is written to be spoken: short sentences, units as words, no symbols.
 * Lines have variants so the same event does not sound robotic every day.
 */
class Persona(
    private val ownerName: String,
    private val distanceUnit: DistanceUnit = DistanceUnit.KM,
    private val pressureUnit: PressureUnit = PressureUnit.PSI,
    private val random: Random = Random.Default,
) {
    private val name: String? = ownerName.trim().takeIf { it.isNotEmpty() }

    private fun pick(vararg options: String): String = options[random.nextInt(options.size)]

    private fun withName(line: String): String = if (name == null) line else "$line, $name"

    fun greeting(hour: Int, state: VehicleState): String {
        val partOfDay = when (hour) {
            in 5..11 -> "Good morning"
            in 12..17 -> "Good afternoon"
            else -> "Good evening"
        }
        val opener = pick(withName(partOfDay) + ".", withName("Welcome back") + ".", withName(partOfDay) + ". All systems are ready.")
        val battery = batteryLine(state)
        val tyres = state.tyres?.lowest()?.let { if (it < 200.0) " One tyre looks a little soft, worth a check." else null } ?: ""
        return listOf(opener, battery).filter { it.isNotBlank() }.joinToString(" ") + tyres
    }

    fun statusReport(state: VehicleState): String {
        if (!state.hasLiveData) return "I can't see the car's data at the moment."
        val parts = mutableListOf(batteryLine(state))
        state.tyres?.let { t ->
            val low = t.lowest()
            if (low != null) {
                parts += if (t.anyBelow(200.0)) {
                    "The lowest tyre is at ${pressure(low)}, a touch soft."
                } else {
                    "Tyres look healthy."
                }
            }
        }
        state.outsideTempC?.let { parts += "It's ${it.roundToInt()} degrees outside." }
        if (state.isCharging) state.chargePowerKw?.let { parts += "Charging at ${oneDecimal(it)} kilowatts." }
        return parts.filter { it.isNotBlank() }.joinToString(" ")
    }

    fun tripSummary(trip: Trip, cost: CostSettings): String {
        val distance = distance(trip.distanceKm)
        val head = pick("Trip complete.", "And we're here.", "Journey complete.")
        val efficiency = trip.consumptionKwhPer100()?.takeIf { it > 0 }?.let {
            " Averaging ${oneDecimal(it)} kilowatt hours per hundred kilometres."
        } ?: ""
        val money = trip.energyKwh?.takeIf { it > 0 }?.let { kwh ->
            val spent = EnergyMath.electricityCost(kwh, cost.pricePerKwh, cost.chargingLossPct)
            val petrol = EnergyMath.petrolCost(trip.distanceKm, cost.petrolLitresPer100Km, cost.petrolPricePerLitre)
            val saved = petrol - spent
            val savedLine = if (saved > 1) " That's ${money(saved, cost.currency)} less than petrol." + pick("", " Not bad at all.", " Rather efficient.") else ""
            " It cost about ${money(spent, cost.currency)}.$savedLine"
        } ?: ""
        return "$head $distance.$efficiency$money"
    }

    fun chargingComplete(session: ChargeSession, cost: CostSettings): String {
        val spent = EnergyMath.electricityCost(session.energyKwh, cost.pricePerKwh, cost.chargingLossPct)
        val soc = session.endSoc?.let { " Battery at ${it.roundToInt()} percent." } ?: ""
        return "Charging finished. ${oneDecimal(session.energyKwh)} kilowatt hours added, about ${money(spent, cost.currency)}.$soc"
    }

    fun lowBattery(state: VehicleState): String {
        val soc = state.socPercent?.roundToInt() ?: return "Battery is running low."
        val range = state.rangeKm?.let { " About ${distance(it.toDouble())} left." } ?: ""
        return "Battery is down to $soc percent.$range Shall I find a charger?"
    }

    fun lowTyre(kpa: Double): String = "A tyre is reading ${pressure(kpa)}. Worth topping up when convenient."

    fun navigating(destination: String): String =
        pick("Setting course for $destination.", "Right away. Directions to $destination.", "Very good. Heading to $destination.")

    fun searching(query: String): String = pick("Showing $query nearby.", "Here's $query close by.")

    fun media(action: String): String = when (action) {
        "pause" -> pick("Paused.", "Music paused.")
        "play" -> pick("Resuming.", "Back to the music.")
        "next" -> pick("Skipping ahead.", "Next track.")
        "previous" -> pick("Going back one.", "Previous track.")
        else -> "Done."
    }

    fun openingApp(appName: String): String = "Opening $appName."

    fun appNotFound(appName: String): String = "I couldn't find $appName on this car."

    fun didNotCatch(): String = pick("I'm afraid I didn't catch that.", "Sorry, could you say that again?")

    fun needsGeminiKey(): String =
        "I can handle the basics: navigation, music and status. For proper conversation, add a Gemini key in Settings."

    fun offline(): String = "I can't reach the internet just now. Basic commands still work."

    private fun batteryLine(state: VehicleState): String {
        val soc = state.socPercent?.roundToInt() ?: return ""
        val range = state.rangeKm?.let { ", roughly ${distance(it.toDouble())} of range" } ?: ""
        return "Battery at $soc percent$range."
    }

    private fun distance(km: Double): String {
        val v = Units.distance(km, distanceUnit)
        val word = if (distanceUnit == DistanceUnit.MI) "miles" else "kilometres"
        return if (v < 10) "${oneDecimal(v)} $word" else "${v.roundToInt()} $word"
    }

    private fun pressure(kpa: Double): String {
        val word = when (pressureUnit) {
            PressureUnit.PSI -> "P S I"
            PressureUnit.BAR -> "bar"
            PressureUnit.KPA -> "kilopascals"
        }
        return "${Units.formatPressure(kpa, pressureUnit)} $word"
    }

    companion object {
        fun oneDecimal(v: Double): String = String.format(Locale.US, "%.1f", v)

        /** "₱152" reads badly aloud, so money is spoken as "152 pesos". */
        fun money(amount: Double, currency: String): String {
            val n = amount.roundToInt()
            val word = when (currency.trim()) {
                "₱", "PHP" -> "pesos"
                "$", "USD", "AUD" -> "dollars"
                "£", "GBP" -> "pounds"
                "€", "EUR" -> "euros"
                "฿", "THB" -> "baht"
                "RM", "MYR" -> "ringgit"
                "Rp", "IDR" -> "rupiah"
                "R$", "BRL" -> "reais"
                else -> currency.trim()
            }
            return "$n $word".trim()
        }
    }
}
