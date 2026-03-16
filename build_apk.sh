#!/bin/bash

# =================================================================
# CONFIGURATION
# =================================================================
APP_NAME="Gaspillage Alimentaire"
PACKAGE_ID="com.gaspi_app"
WEB_DIR="www"
ANDROID_SDK_PATH="$HOME/android-sdk"
JAVA_HOME_PATH="/usr/lib/jvm/java-21-openjdk-amd64"
WORKING_DIR=$(pwd)
KEYSTORE_FILE="my-release-key.jks"
KEY_ALIAS="my-key-alias"
STORE_PASS="password123"

SOURCE_ACTIVITY2="/home/julien2002/Developpement/GASPIPI/gaspi_app/activity2"

# COULEURS
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}    🚀 BUILDER PROD : FIX DOUBLONS KOTLIN          ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. ENVIRONNEMENT
export JAVA_HOME="$JAVA_HOME_PATH"
export PATH=$JAVA_HOME/bin:$PATH

# 2. KEYSTORE
if [ ! -f "$KEYSTORE_FILE" ]; then
    echo -e "${YELLOW}--- 🔑 Génération de la clé (100k j) ---${NC}"
    keytool -genkey -v -keystore "$KEYSTORE_FILE" -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 100000 \
    -storepass "$STORE_PASS" -keypass "$STORE_PASS" \
    -dname "CN=Julien, OU=Dev, O=GaspiApp, L=Paris, ST=France, C=FR"
fi

# 3. NETTOYAGE
echo -e "${YELLOW}--- 🧹 Nettoyage ---${NC}"
rm -rf android node_modules package* capacitor* "$WEB_DIR" assets

# 4. PRÉPARATION WWW
npm init -y > /dev/null
mkdir -p "$WEB_DIR/images"
cp index.html styles.css script.js config.json manifest.json "$WEB_DIR/" 2>/dev/null
[ -d "images" ] && cp -r images/* "$WEB_DIR/images/"
[ -d "$SOURCE_ACTIVITY2" ] && cp -r "$SOURCE_ACTIVITY2" "$WEB_DIR/"

# 5. INSTALLATION
echo -e "${YELLOW}--- 🛠️  Installation dépendances ---${NC}"
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/status-bar @capacitor-community/keep-awake @capacitor/assets > /dev/null 2>&1

# 6. CAPACITOR
cat <<EOT > capacitor.config.json
{ "appId": "$PACKAGE_ID", "appName": "$APP_NAME", "webDir": "$WEB_DIR", "server": { "androidScheme": "https" } }
EOT
npx cap add android > /dev/null 2>&1

# 7. ICONES
if [ -f "icon.png" ]; then
    mkdir -p assets && cp icon.png assets/icon-only.png && cp icon.png assets/icon-foreground.png && cp icon.png assets/icon-background.png
    npx capacitor-assets generate --android > /dev/null 2>&1
fi

# 8. CONFIG SDK & PATCH KOTLIN (CORRECTION DOUBLONS)
echo "sdk.dir=$ANDROID_SDK_PATH" > android/local.properties

# On force la version de Kotlin dans variables.gradle
sed -i "s/kotlinStdlibVersion = .*/kotlinStdlibVersion = '1.8.22'/" android/variables.gradle

# On patche build.gradle pour EXCLURE les modules jdk7 et jdk8 qui causent le crash
cat <<EOT >> android/app/build.gradle

configurations.all {
    resolutionStrategy.eachDependency { DependencyResolveDetails details ->
        if (details.requested.group == 'org.jetbrains.kotlin') {
            details.useVersion "1.8.22"
        }
    }
    exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk8'
    exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk7'
}
EOT

# 9. MAINACTIVITY
PACKAGE_PATH=$(echo "$PACKAGE_ID" | sed 's/\./\//g')
mkdir -p "android/app/src/main/java/$PACKAGE_PATH"
cat <<EOT > "android/app/src/main/java/$PACKAGE_PATH/MainActivity.java"
package $PACKAGE_ID;
import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }
}
EOT

# 10. COMPILATION
echo -e "${YELLOW}--- 🏗️  Compilation Release ---${NC}"
npx cap sync android > /dev/null 2>&1
cd android && chmod +x gradlew
./gradlew assembleRelease
GRADLE_EXIT=$?
cd ..

if [ $GRADLE_EXIT -ne 0 ]; then
    echo -e "${RED}❌ Erreur : La compilation a échoué malgré le correctif.${NC}"
    exit 1
fi

# 11. SIGNATURE
echo -e "${YELLOW}--- ✍️  Signature de l'APK ---${NC}"
SAFE_NAME=$(echo "$APP_NAME" | sed 's/ /_/g')
UNSIGNED_APK=$(find android/app/build/outputs/apk/release -name "*.apk" 2>/dev/null | head -n 1)
APKSIGNER=$(find "$ANDROID_SDK_PATH/build-tools" -name "apksigner" | sort -r | head -n 1)

$APKSIGNER sign --ks "$KEYSTORE_FILE" --ks-pass "pass:$STORE_PASS" \
    --out "${SAFE_NAME}_PROD_signed.apk" "$UNSIGNED_APK"

# 12. FIN
if [ $? -eq 0 ]; then
    rm -rf android node_modules "$WEB_DIR" assets package* capacitor*
    echo -e "${GREEN}====================================================${NC}"
    echo -e "${GREEN}✅ APK PRÊT ET SIGNÉ : ${SAFE_NAME}_PROD_signed.apk${NC}"
    echo -e "${GREEN}====================================================${NC}"
else
    echo -e "${RED}❌ Erreur signature.${NC}"
fi
