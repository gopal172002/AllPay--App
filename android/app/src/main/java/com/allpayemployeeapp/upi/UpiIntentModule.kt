package com.allpayemployeeapp.upi

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule

/**
 * Launches a generic UPI Intent (ACTION_VIEW upi://pay?...) and returns the
 * Activity Result extras. Expenzo never collects UPI PIN or bank credentials.
 * The external UPI app performs the payment.
 */
@ReactModule(name = UpiIntentModule.NAME)
class UpiIntentModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "UpiIntentModule"
    private const val REQUEST_CODE = 7912
  }

  private var pendingPromise: Promise? = null

  private val activityEventListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        intent: Intent?,
      ) {
        if (requestCode != REQUEST_CODE) {
          return
        }
        val promise = pendingPromise ?: return
        pendingPromise = null
        val raw = extrasToQuery(intent)
        val map = Arguments.createMap()
        if (raw.isNotBlank()) {
          map.putBoolean("cancelled", false)
          map.putInt("resultCode", resultCode)
          map.putString("raw", raw)
          promise.resolve(map)
          return
        }
        if (resultCode == Activity.RESULT_CANCELED) {
          map.putBoolean("cancelled", true)
          map.putInt("resultCode", resultCode)
          map.putString("raw", "")
          promise.resolve(map)
          return
        }
        map.putBoolean("cancelled", false)
        map.putInt("resultCode", resultCode)
        map.putString("raw", "")
        promise.resolve(map)
      }
    }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = NAME

  private fun hostActivity(): Activity? = reactApplicationContext.currentActivity

  @ReactMethod
  fun hasCompatibleApp(upiUri: String, promise: Promise) {
    if (!isSafeUpiUri(upiUri)) {
      promise.resolve(false)
      return
    }
    val activity = hostActivity()
    if (activity == null) {
      promise.resolve(false)
      return
    }
    promise.resolve(canResolveUpi(activity, upiUri))
  }

  @ReactMethod
  fun pay(upiUri: String, packageName: String?, promise: Promise) {
    if (!isSafeUpiUri(upiUri)) {
      promise.reject("INVALID_URI", "Only upi://pay URIs can be launched")
      return
    }
    val activity = hostActivity()
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No Android activity is available")
      return
    }
    if (pendingPromise != null) {
      promise.reject("IN_FLIGHT", "A UPI payment is already in progress")
      return
    }
    if (!canResolveUpi(activity, upiUri)) {
      val map = Arguments.createMap()
      map.putBoolean("noApp", true)
      promise.resolve(map)
      return
    }
    pendingPromise = promise
    UiThreadUtil.runOnUiThread {
      try {
        val viewIntent = Intent(Intent.ACTION_VIEW, Uri.parse(upiUri))
        viewIntent.addCategory(Intent.CATEGORY_DEFAULT)
        val targetPackage = packageName?.trim().orEmpty()
        if (targetPackage.isNotEmpty()) {
          viewIntent.setPackage(targetPackage)
          if (viewIntent.resolveActivity(activity.packageManager) == null) {
            // Preferred app missing / cannot handle — fall back to chooser.
            viewIntent.setPackage(null)
            val chooser = Intent.createChooser(viewIntent, "Pay using")
            activity.startActivityForResult(chooser, REQUEST_CODE)
          } else {
            activity.startActivityForResult(viewIntent, REQUEST_CODE)
          }
        } else {
          val chooser = Intent.createChooser(viewIntent, "Pay using")
          activity.startActivityForResult(chooser, REQUEST_CODE)
        }
      } catch (error: Exception) {
        pendingPromise = null
        promise.reject("LAUNCH_FAILED", error.message)
      }
    }
  }

  private fun canResolveUpi(activity: Activity, upiUri: String): Boolean {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(upiUri))
    return intent.resolveActivity(activity.packageManager) != null ||
      activity.packageManager
        .queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
        .isNotEmpty()
  }

  private fun isSafeUpiUri(upiUri: String): Boolean {
    val trimmed = upiUri.trim()
    return trimmed.length <= 2048 && trimmed.startsWith("upi://pay?", ignoreCase = true)
  }

  private fun extrasToQuery(intent: Intent?): String {
    if (intent == null) {
      return ""
    }
    val parts = ArrayList<String>()
    val extras = intent.extras
    if (extras != null) {
      for (key in extras.keySet()) {
        val value = extras.get(key)?.toString() ?: continue
        if (value.isBlank()) {
          continue
        }
        parts.add("${Uri.encode(key)}=${Uri.encode(value)}")
      }
    }
    val data = intent.dataString
    if (!data.isNullOrBlank()) {
      parts.add("data=${Uri.encode(data)}")
    }
    return parts.joinToString("&")
  }
}
