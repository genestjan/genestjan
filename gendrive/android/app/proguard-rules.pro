# kotlinx.serialization: keep generated serializers for GenDrive's data classes.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keep,includedescriptorclasses class com.genestjanramirez.gendrive.**$$serializer { *; }
-keepclassmembers class com.genestjanramirez.gendrive.** {
    *** Companion;
}
-keepclasseswithmembers class com.genestjanramirez.gendrive.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# dadb and okio reference optional desktop/JVM classes that do not exist on Android.
-dontwarn org.graalvm.**
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
-dontwarn org.codehaus.mojo.animal_sniffer.**
-dontwarn java.lang.management.**
-dontwarn javax.annotation.**
-dontwarn dadb.adbserver.**

# The BYD car API is reached by reflection on the car's own framework classes,
# which are not inside this APK, so there is nothing of ours to keep for it.
