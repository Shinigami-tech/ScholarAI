export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(2)} GB`;
}

export function getFileExtension(
  name: string
) {
  return (
    name.split(".").pop()?.toUpperCase() ||
    "FILE"
  );
}

export function createId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function getLanguageName(
  language: "en" | "ru" | "ko"
) {
  if (language === "ru") {
    return "Russian";
  }

  if (language === "ko") {
    return "Korean";
  }

  return "English";
}
