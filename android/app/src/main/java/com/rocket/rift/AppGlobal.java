package com.rocket.rift;

import android.app.Application;
import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;

import com.appsflyer.AppsFlyerConversionListener;
import com.appsflyer.AppsFlyerLib;
import com.appsflyer.attribution.AppsFlyerRequestListener;

import java.util.Map;
import java.util.Objects;


public class AppGlobal extends Application {
    private static Context mContext;

    @Override
    public void onCreate() {
        super.onCreate();
        mContext = this;

        AppsFlyerConversionListener conversionListener = new AppsFlyerConversionListener() {
            @Override
            public void onConversionDataSuccess(Map<String, Object> map) {
                for (String attrName : map.keySet())
                {
                    Log.d("AFDashBoard", "Conversion Success: " + attrName + "\nData Map:" + map.get(attrName));
                    String status = Objects.requireNonNull(map.get("af_status")).toString();
                    if(status.equals("Organic"))
                        Log.d("AFDashBoard", "Organic Install");
                    else
                        Log.d("AFDashBoard", "Non-Organic Install");
                }
            }

            @Override
            public void onConversionDataFail(String s) { Log.e("AFDashBoard", "Error Conversion of Event: " + s); }

            @Override
            public void onAppOpenAttribution(Map<String, String> map) { Log.d("AFDashBoard", "First Open Attribution event)"); }

            @Override
            public void onAttributionFailure(String s) {
                Log.e("AFDashBoard", "Attribution error: " + s);
            }
        };

        AppsFlyerLib.getInstance().init(getString(R.string.appsFlyerAppID), conversionListener, getApplicationContext());
        AppsFlyerLib.getInstance().setDebugLog(true);

        AppsFlyerLib.getInstance().start(getApplicationContext(), getString(R.string.appsFlyerAppID), new AppsFlyerRequestListener() {
            @Override
            public void onSuccess() {
                Log.d("AFDashBoard", "AF Initialized Successfully");
            }

            @Override
            public void onError(int i, @NonNull String s) {
                Log.d("AFDashBoard", "AF Not Initialized.\n\nError Code: " + i + "\nError Message: " + s);
            }
        });

    }
    public static void sendAnalytics(String mEventName, String mEventData)
    {
        //region [ AF Send Event ]
        AppsFlyerLib.getInstance().logEvent(mContext, mEventName, null);
        //endregion
    }
}
