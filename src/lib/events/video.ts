/**
 * What an operator pastes, turned into something a page can embed.
 *
 * The field accepts a URL rather than an id because a URL is what you get when
 * you press Share, and asking somebody to find "the bit after `v=`" is asking
 * them to do a parse the code can do. Every shape YouTube actually hands out is
 * accepted — watch links, `youtu.be`, `/embed/`, `/live/`, `/shorts/`, and any
 * of them with a playlist or timestamp hanging off the end.
 *
 * It returns `null` rather than guessing. A malformed link renders no section,
 * which is the honest outcome: a broken player is worse than no player, and the
 * operator can see at a glance in the preview that the link did not take.
 */
export interface EventVideo {
  provider: "youtube" | "vimeo";
  id: string;
  /** The privacy-preserving host. Sets no cookie until the video is played. */
  embedUrl: string;
  /** Poster layers, best first. `maxresdefault` is absent on any video never
   *  uploaded above 720p, so it is stacked over `hqdefault`, which YouTube
   *  generates for every video. Vimeo needs an API call for its poster, so it
   *  supplies none and falls back to the template's own plate. */
  posters: string[];
  watchUrl: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseEventVideo(raw: string | undefined): EventVideo | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  let url: URL;
  try {
    // A bare id is a fair thing to paste too, and a URL with no scheme is what
    // a browser address bar shows.
    if (YT_ID.test(value)) return youtube(value);
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return parts[0] && YT_ID.test(parts[0]) ? youtube(parts[0]) : null;

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && YT_ID.test(v)) return youtube(v);
    // /embed/ID, /live/ID, /shorts/ID, /v/ID
    if (["embed", "live", "shorts", "v"].includes(parts[0]) && parts[1] && YT_ID.test(parts[1])) {
      return youtube(parts[1]);
    }
    return null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parts.find((p) => /^\d{6,}$/.test(p));
    return id
      ? {
          provider: "vimeo",
          id,
          embedUrl: `https://player.vimeo.com/video/${id}?dnt=1&autoplay=1`,
          posters: [],
          watchUrl: `https://vimeo.com/${id}`,
        }
      : null;
  }

  return null;
}

function youtube(id: string): EventVideo {
  return {
    provider: "youtube",
    id,
    // `youtube-nocookie.com` and `autoplay=1` together are what make the
    // click-to-load pattern work: nothing is requested from Google until the
    // visitor asks for the video, and when they do it starts without a second
    // press. `rel=0` keeps the end screen inside the channel.
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
    posters: [
      `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    ],
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
  };
}
