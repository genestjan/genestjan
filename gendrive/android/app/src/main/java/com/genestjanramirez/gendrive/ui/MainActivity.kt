package com.genestjanramirez.gendrive.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.genestjanramirez.gendrive.graph
import com.genestjanramirez.gendrive.service.DriveService

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DriveService.start(this)
        val g = graph
        setContent { GenDriveRoot(g) }
    }

    override fun onResume() {
        super.onResume()
        // Permissions may have changed in Android settings while we were away.
        graph.media.refresh()
        graph.apps.refresh()
    }
}
