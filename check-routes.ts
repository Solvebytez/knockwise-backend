import mongoose from "mongoose";
import { env } from "./src/config/env";
import { Route } from "./src/models/Route";

async function checkRoutes() {
  try {
    await mongoose.connect(env.mongoUri);

    const routes = await Route.find({}).sort({ createdAt: -1 }).limit(1);

    if (routes.length === 0) {
      console.log("No routes found in database");
      await mongoose.disconnect();
      return;
    }

    const route = routes[0]!;

    console.log("=== LATEST ROUTE ===");
    console.log("Name:", route.name);
    console.log("Total Distance:", route.totalDistance, "miles");
    console.log("Total Duration:", route.totalDuration, "minutes");
    console.log("\n=== ROUTE DETAILS ===");
    console.log("Has routeDetails?", !!route.routeDetails);
    console.log(
      "Selected Alternative Index:",
      route.routeDetails?.selectedAlternativeIndex
    );
    console.log(
      "Number of Alternatives:",
      route.routeDetails?.alternatives?.length || 0
    );

    console.log("\n=== ALTERNATIVES SUMMARY ===");
    route.routeDetails?.alternatives?.forEach((alt: any, idx: number) => {
      console.log(`\nAlternative ${idx + 1}:`);
      console.log("  Summary:", alt.summary);
      console.log("  Distance:", alt.distance, "miles");
      console.log("  Duration:", alt.duration, "minutes");
      console.log("  Traffic:", alt.trafficCondition);
      console.log("  Legs:", alt.legs?.length || 0);
      console.log("  Steps in first leg:", alt.legs?.[0]?.steps?.length || 0);
    });

    console.log("\n=== FIRST 3 STEPS FROM ALTERNATIVE 1 ===");
    const firstAlt = route.routeDetails?.alternatives?.[0];
    const firstLeg = firstAlt?.legs?.[0];
    firstLeg?.steps?.slice(0, 3).forEach((step: any, idx: number) => {
      console.log(`\nStep ${idx + 1}:`);
      console.log("  Instruction:", step.instruction);
      console.log("  Distance:", step.distance, "meters");
      console.log("  Duration:", step.duration, "seconds");
      console.log("  Maneuver:", step.maneuver || "N/A");
    });

    console.log("\n=== BOUNDS & METADATA ===");
    console.log("Bounds:", route.routeDetails?.bounds ? "YES" : "NO");
    console.log(
      "Copyrights:",
      route.routeDetails?.copyrights?.substring(0, 50) + "..." || "N/A"
    );
    console.log("Calculated At:", route.routeDetails?.calculatedAt || "N/A");

    await mongoose.disconnect();
    console.log("\n✅ Database check complete");
  } catch (error) {
    console.error("Error checking routes:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkRoutes();
