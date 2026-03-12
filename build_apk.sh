#!/bin/bash

# =================================================================
# CONFIGURATION
# =================================================================
APP_NAME="GASPIPI"
PACKAGE_ID="com.julien2002.gaspipi"
WEB_DIR="www"
ANDROID_SDK_PATH="$HOME/android-sdk"
JAVA_HOME_PATH="/usr/lib/jvm/java-21-openjdk-amd64"
WORKING_DIR=$(pwd)

# COULEURS
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   🚀 BUILDER GASPIPI : FIX JAVA STRUCTURE          ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. ENVIRONNEMENT
export JAVA_HOME="$JAVA_HOME_PATH"
export PATH=$JAVA_HOME/bin:$PATH

# 2. NETTOYAGE COMPLET
echo -e "${YELLOW}--- 🧹 Nettoyage ---${NC}"
rm -rf android node_modules package* capacitor* $WEB_DIR *.apk

# 3. PRÉPARATION WWW
echo -e "${YELLOW}--- 📦 Préparation www ---${NC}"
npm init -y > /dev/null
mkdir -p $WEB_DIR/images
cp index.html styles.css script.js config.json manifest.json $WEB_DIR/ 2>/dev/null
[ -d "images" ] && cp -r images/* $WEB_DIR/images/

# 4. INSTALLATION DÉPENDANCES
echo -e "${YELLOW}--- 🛠️ Installation Plugins ---${NC}"
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/status-bar @capacitor-community/keep-awake

# 5. INITIALISATION CAPACITOR
echo -e "${YELLOW}--- 🤖 Initialisation Capacitor ---${NC}"
cat <<EOT > capacitor.config.json
{
  "appId": "$PACKAGE_ID",
  "appName": "$APP_NAME",
  "webDir": "$WEB_DIR",
  "server": { "androidScheme": "https" }
}
EOT

npx cap add android

# 6. CONFIGURATION SDK
echo "sdk.dir=$ANDROID_SDK_PATH" > android/local.properties

# 7. PATCH ANTI-DOUBLONS KOTLIN
echo -e "${YELLOW}--- 🩹 Patching Gradle ---${NC}"
sed -i "s/ext {/ext {\n    kotlinStdlibVersion = '1.8.22'/" android/variables.gradle

cat <<EOT >> android/app/build.gradle
configurations.all {
    resolutionStrategy {
        force 'org.jetbrains.kotlin:kotlin-stdlib:1.8.22'
    }
    exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk8'
    exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk7'
}
EOT

# 8. RÉÉCRITURE PROPRE DE MAINACTIVITY (Mode Kiosque Immersif)
echo -e "${YELLOW}--- 📺 Configuration MainActivity (Java) ---${NC}"
PACKAGE_PATH=$(echo $PACKAGE_ID | sed 's/\./\//g')
MAIN_ACTIVITY_PATH="android/app/src/main/java/$PACKAGE_PATH/MainActivity.java"

cat <<EOT > "$MAIN_ACTIVITY_PATH"
package $PACKAGE_ID;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Mode Immersif Total (cache barre de navigation et statut)
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }
}
EOT

# 9. COMPILATION
echo -e "${YELLOW}--- 🏗️  Compilation finale ---${NC}"
npx cap sync android
cd android && chmod +x gradlew
./gradlew assembleDebug

# 10. RESULTAT
if [ $? -eq 0 ]; then
    cd $WORKING_DIR
    cp android/app/build/outputs/apk/debug/app-debug.apk ./${APP_NAME}_FIXED.apk
    echo -e "${GREEN}====================================================${NC}"
    echo -e "${GREEN}✅ APK GÉNÉRÉ : ${APP_NAME}_FIXED.apk${NC}"
    echo -e "${GREEN}====================================================${NC}"
else
    echo -e "${RED}❌ Erreur fatale lors de la compilation.${NC}"
    exit 1
fi
