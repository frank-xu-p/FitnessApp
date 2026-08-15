import { VideoImporter } from "../components/VideoImporter";
import { useRouter } from "expo-router";

export default function ImportVideoScreen() {
  const router = useRouter();
  return (
    <VideoImporter
      onImported={() => {
        router.back();
      }}
    />
  );
}
