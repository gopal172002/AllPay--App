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
    /** Payment apps only — never WhatsApp or other upi:// handlers. */
    private val UPI_PAYMENT_PACKAGES = listOf(
      "net.one97.paytm",
      "com.phonepe.app",
      "com.google.android.apps.nbu.paisa.user",
      "in.org.npci.upiapp",
    )
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
    promise.resolve(canResolveUpiPaymentApp(activity, upiUri))
  }

  @ReactMethod
  fun openApp(packageName: String, promise: Promise) {
    val activity = hostActivity()
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No Android activity is available")
      return
    }
    val pkg = packageName.trim()
    if (pkg.isEmpty()) {
      promise.reject("INVALID_PACKAGE", "Package name is required")
      return
    }
    UiThreadUtil.runOnUiThread {
      try {
        val launch = activity.packageManager.getLaunchIntentForPackage(pkg)
        if (launch == null) {
          val map = Arguments.createMap()
          map.putBoolean("noApp", true)
          promise.resolve(map)
          return@runOnUiThread
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(launch)
        val map = Arguments.createMap()
        map.putBoolean("opened", true)
        promise.resolve(map)
      } catch (error: Exception) {
        promise.reject("LAUNCH_FAILED", error.message)
      }
    }
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
    if (!canResolveUpiPaymentApp(activity, upiUri)) {
      val map = Arguments.createMap()
      map.putBoolean("noApp", true)
      promise.resolve(map)
      return
    }
    pendingPromise = promise
    UiThreadUtil.runOnUiThread {
      try {
        launchUpiPayment(activity, upiUri, packageName?.trim().orEmpty())
      } catch (error: Exception) {
        pendingPromise = null
        promise.reject("LAUNCH_FAILED", error.message)
      }
    }
  }

  private fun launchUpiPayment(activity: Activity, upiUri: String, preferredPackage: String) {
    val pm = activity.packageManager
    val query = upiUri.substringAfter("?", "")

    if (preferredPackage == "net.one97.paytm" && query.isNotEmpty()) {
      val paytmIntent = Intent(Intent.ACTION_VIEW, Uri.parse("paytmmp://pay?$query"))
      paytmIntent.addCategory(Intent.CATEGORY_DEFAULT)
      paytmIntent.setPackage("net.one97.paytm")
      if (paytmIntent.resolveActivity(pm) != null) {
        activity.startActivityForResult(paytmIntent, REQUEST_CODE)
        return
      }
    }

    val uri = Uri.parse(upiUri)

    if (preferredPackage.isNotEmpty() && UPI_PAYMENT_PACKAGES.contains(preferredPackage)) {
      val direct = Intent(Intent.ACTION_VIEW, uri)
      direct.addCategory(Intent.CATEGORY_DEFAULT)
      direct.setPackage(preferredPackage)
      if (direct.resolveActivity(pm) != null) {
        activity.startActivityForResult(direct, REQUEST_CODE)
        return
      }
    }

    val targets = ArrayList<Intent>()
    val orderedPackages =
      if (preferredPackage.isNotEmpty() && UPI_PAYMENT_PACKAGES.contains(preferredPackage)) {
        listOf(preferredPackage) + UPI_PAYMENT_PACKAGES.filter { it != preferredPackage }
      } else {
        UPI_PAYMENT_PACKAGES
      }

    for (pkg in orderedPackages) {
      val intent = Intent(Intent.ACTION_VIEW, uri)
      intent.addCategory(Intent.CATEGORY_DEFAULT)
      intent.setPackage(pkg)
      if (intent.resolveActivity(pm) != null) {
        targets.add(intent)
      }
    }

    if (targets.isEmpty()) {
      pendingPromise?.let { p ->
        pendingPromise = null
        val map = Arguments.createMap()
        map.putBoolean("noApp", true)
        p.resolve(map)
      }
      return
    }

    if (targets.size == 1) {
      activity.startActivityForResult(targets[0], REQUEST_CODE)
      return
    }

    val primary = targets.removeAt(0)
    val chooser = Intent.createChooser(primary, "Pay using")
    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, targets.toTypedArray())
    activity.startActivityForResult(chooser, REQUEST_CODE)
  }

  private fun canResolveUpiPaymentApp(activity: Activity, upiUri: String): Boolean {
    val uri = Uri.parse(upiUri)
    for (pkg in UPI_PAYMENT_PACKAGES) {
      val intent = Intent(Intent.ACTION_VIEW, uri)
      intent.setPackage(pkg)
      if (intent.resolveActivity(activity.packageManager) != null) {
        return true
      }
    }
    return false
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
