import { app } from "@azure/functions";
import "./functions/getLights";
import "./functions/updateLightLocation";

app.setup({
  enableHttpStream: true,
});
