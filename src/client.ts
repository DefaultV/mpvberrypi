interface IMPVStreamInfo {
  status: "idle" | "searching" | "playing" | "buffering" | "paused";
  metadata?: string;
  videoUrl?: string;
  searchQuery?: string;
}
const socket = new WebSocket(`ws://${location.host}:8080`);
const inputField: HTMLInputElement = document.getElementById(
  "queryinput"
) as HTMLInputElement;
const statusField: HTMLDivElement = document.getElementById(
  "status"
) as HTMLDivElement;
const loadingElement: HTMLDivElement = document.getElementById(
  "loader"
) as HTMLDivElement;
const historyElement: HTMLDivElement = document.getElementById(
  "history"
) as HTMLDivElement;
const stopElement: HTMLButtonElement = document.getElementById(
  "stop"
) as HTMLButtonElement;
const playElement: HTMLButtonElement = document.getElementById(
  "play"
) as HTMLButtonElement;
const pauseElement: HTMLButtonElement = document.getElementById(
  "pause"
) as HTMLButtonElement;
const scrubbarElement: HTMLButtonElement = document.getElementById(
  "scrubbar"
) as HTMLButtonElement;

let scrubberDown = false;
scrubbarElement?.addEventListener("pointerdown", (ev) => {
  scrubberDown = true;
  setScrubberWidth(ev.offsetX / scrubbarElement.clientWidth, true);
});
scrubbarElement?.addEventListener("pointermove", (ev) => {
  if (scrubberDown) {
    setScrubberWidth(ev.offsetX / scrubbarElement.clientWidth, true);
  }
});
window.addEventListener("pointerup", (ev) => {
  scrubberDown = false;
});
scrubbarElement?.addEventListener("pointerout", (ev) => {
  scrubberDown = false;
});

document.getElementById("search")?.addEventListener("click", () => {
  sendWSQuery(inputField.value);
});
playElement?.addEventListener("click", () => {
  sendWSPause(false);
});
pauseElement?.addEventListener("click", () => {
  sendWSPause(true);
});
stopElement?.addEventListener("click", () => {
  SendWSKill();
});
document.getElementById("shutdown")?.addEventListener("click", () => {
  sendWSShutdown();
});

let lastQuery = "";
const sendWSQuery = (query: string) => {
  socket.send(`play:${query}`);
  lastQuery = query;
};
const SendWSKill = () => {
  socket.send("kill:all");
};
const sendWSShutdown = () => {
  socket.send("shutdown:all");
};
const sendWSStatus = () => {
  socket.send("status:all");
};
const sendWSHistory = () => {
  socket.send("history:all");
};
const sendWSPause = (pause: boolean) => {
  socket.send(`pause:${pause}`);
};
const sendWSIndex = (index: number) => {
  socket.send(`index:${index}`);
};

const setScrubberWidth = (percentWidth: number, update?: boolean) => {
  (scrubbarElement.firstElementChild! as HTMLDivElement).style.width = `${
    percentWidth * 100
  }%`;

  update && percentIndexToRealIndex(percentWidth);
};

const percentIndexToRealIndex = (indexPercent: number) => {
  const totalLength = getTotalVideoLength();
  sendWSIndex(indexPercent * totalLength);
};

const getTotalVideoLength = () => {
  const info = MPVInfo();
  if (info.metadata) {
    const split = info.metadata.split("/");
    const totalSplit = split[1].split("(")[0].split(":");
    const total =
      parseInt(totalSplit[0]) * 60 * 60 +
      parseInt(totalSplit[1]) * 60 +
      parseInt(totalSplit[2]);

    return total;
  }
  return 0;
};

function isMPVStreamInfo(
  info: IMPVStreamInfo | string[]
): info is IMPVStreamInfo {
  return (info as IMPVStreamInfo).status !== undefined;
}

const populateHistory = (items: string[]) => {
  const newItems: HTMLDivElement[] = [];
  const uniqueHistory = new Set(items);

  uniqueHistory.forEach((item) => {
    if (item.length <= 0) return;
    const historyItem = document.createElement("div");
    historyItem.classList.add("history-item");
    historyItem.innerHTML = item;
    historyItem.addEventListener("click", () => {
      inputField.value = item;
      sendWSQuery(item);
    });

    newItems.push(historyItem);
  });

  historyElement.replaceChildren(...newItems);
};

// Listen for messages
socket.addEventListener("message", function (event) {
  if (event.data == "error") {
    if (
      confirm(
        "There was an error preparing the audio stream, do you want to try again?"
      )
    ) {
      sendWSQuery(lastQuery);
    }
    return;
  }
  const info: IMPVStreamInfo | string[] = JSON.parse(event.data);
  const isMPVInfo = isMPVStreamInfo(info);

  if (isMPVInfo) handleOnInfo(info);
  else populateHistory(info);
});

const handleOnInfo = (info: IMPVStreamInfo) => {
  if (info.status == "idle") setScrubberWidth(0);
  const isLoading = info.status == "buffering" || info.status == "searching";
  const searchQuery = info.searchQuery ? info.searchQuery : "";
  const videoUrl = info.videoUrl
    ? `${
        info.status == "playing" || info.status == "paused"
          ? `(${searchQuery})<br>`
          : ""
      }${info.videoUrl}`
    : "";

  let videoIndex: string = "";
  let videoLength: string = "";
  if (info.metadata) {
    const split = info.metadata.split("/");
    videoIndex = split[0].split("A:")[1];
    videoLength = split[1].split("(")[0];
  }

  const videoData =
    videoIndex && videoLength ? `${videoIndex} / ${videoLength}` : "";

  const streamInfo = `<b>${info.status}</b> ${
    info.status == "searching" ? searchQuery : ""
  } ${videoUrl}<br>${videoData}`;
  statusField.innerHTML = streamInfo;

  specifyClassList(isLoading, loadingElement, "active");
  specifyClassList(info.status != "idle", stopElement, "active");
  specifyClassList(info.status == "paused", playElement, "active");
  specifyClassList(info.status == "playing", pauseElement, "active");
  specifyClassList(
    info.status == "playing" || info.status == "paused",
    scrubbarElement,
    "active"
  );

  MPVInfo(info);
  if (info.metadata) {
    const indexSplit = info.metadata?.split("/")[0].split(":");
    indexSplit.shift();
    const index =
      parseInt(indexSplit[0]) * 60 * 60 +
      parseInt(indexSplit[1]) * 60 +
      parseInt(indexSplit[2]);
    setScrubberWidth(index / getTotalVideoLength());
  }
};

const mpv_info: IMPVStreamInfo = { status: "idle" };
const MPVInfo = (info?: IMPVStreamInfo) => {
  if (info) {
    Object.assign(mpv_info, info);
  }
  return mpv_info;
};

const specifyClassList = (
  add: boolean,
  element: HTMLElement,
  className: string
) => {
  if (add) {
    if (!element.classList.contains(className)) {
      element.classList.add(className);
    }
  } else {
    if (element.classList.contains(className)) {
      element.classList.remove(className);
    }
  }
};

inputField.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendWSQuery(inputField.value);
  }
});

socket.addEventListener("open", () => {
  sendWSStatus();
  sendWSHistory();
});
