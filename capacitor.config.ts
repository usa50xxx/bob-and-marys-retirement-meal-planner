import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bobandmary.mealplanner",
  appName: "Bob and Mary's Meal Planner",
  webDir: process.env.CAPACITOR_WEB_DIR || "outputs/meal-planner",
  android: {
    allowMixedContent: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
