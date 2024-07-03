/*
       Licensed to the Apache Software Foundation (ASF) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  The ASF licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
 */

package com.rocket.rift;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Button;

import androidx.appcompat.app.AlertDialog;

import com.appsflyer.AppsFlyerLib;

import org.apache.cordova.*;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends CordovaActivity
{

    @Override
    public void onCreate(Bundle savedInstanceState)
    {


        super.onCreate(savedInstanceState);

        // enable Cordova apps to be started in the background
        Bundle extras = getIntent().getExtras();
        if (extras != null && extras.getBoolean("cdvStartInBackground", false)) {
            moveTaskToBack(true);
        }


        // Check internet connectivity
        if (isConnected()) {
            loadUrl(launchUrl);
            WebView webView = (WebView) appView.getEngine().getView();
            JsObject JsObject = new JsObject(this, webView);
            webView.addJavascriptInterface(JsObject, "jsBridge");
        } else {

            PromtUserNetworkNotification();
        }


    }


    private boolean isConnected() {
        ConnectivityManager connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager != null) {
            NetworkInfo activeNetwork = connectivityManager.getActiveNetworkInfo();
            return activeNetwork != null && activeNetwork.isConnected();
        }
        return false;
    }

    public void PromtUserNetworkNotification() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        View uiPrompt = LayoutInflater.from(this).inflate(R.layout.ui_networkpromt, null);
        builder.setView(uiPrompt);

        Button btnRetry = uiPrompt.findViewById(R.id.btnRetry);
        Button btnQuit = uiPrompt.findViewById(R.id.btnQuit);

        final AlertDialog dialog = builder.create(); // Create AlertDialog instance

        btnRetry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (isConnected()) {
                    dialog.dismiss(); // Dismiss dialog if connected
                    loadUrl(launchUrl); // Retry loading URL
                } else {
                    // Optionally handle retry logic or inform user about connectivity status
                }
            }
        });

        btnQuit.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish(); // Close the activity
            }
        });

        dialog.setCancelable(false);
        dialog.show();
    }

    class JsObject {

        private Context mContext;

        public JsObject(Context mContext, WebView webView) {
            this.mContext = mContext;
        }

        //region [ AF ]
        @JavascriptInterface
        public void postMessage(String eventName, String eventData) {
            try {
                LOG.i("AFDashboard", "Event: " + eventName);

                if (TextUtils.isEmpty(eventName) || eventData == null) {
                    LOG.e("AFDashboard", "Unable to Parse SideB");
                    return;
                }
                if (eventName.equals("openWindow")) {
                    JSONObject appData = new JSONObject(eventData);
                    String url = appData.getString("url");
                    openExternal(mContext, url);

                } else {
                    AppsFlyerLib.getInstance().logEvent(mContext, eventName, null);
                }
            } catch (JSONException ex) {
                LOG.e("AFDashboard", "data object passed to postMessage has caused a JSON error.");
            }
        }

    }

    public static void openExternal(Context mContext, String mLink)
    {
        Intent cdvIntent = new Intent(mContext, MainActivity.class);
        mContext.startActivity(cdvIntent);
    }
}
