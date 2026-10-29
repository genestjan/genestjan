package com.genestjanramirez.monggols

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.genestjanramirez.monggols.preview.R
import org.junit.Rule
import org.junit.Test

class ScreensTest {
    @get:Rule
    val paparazzi = Paparazzi(
        deviceConfig = DeviceConfig.PIXEL_6.copy(screenHeight = 3900),
        theme = "Theme.Monggols",
    )

    @Test
    fun home() {
        paparazzi.snapshot(paparazzi.inflate(R.layout.activity_main))
    }
}
