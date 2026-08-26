import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locale";
import { loadMessages } from "./messages";

// No i18n routing: the active locale comes from a cookie the client sets, read
// server-side so the first paint is already in the right language (no flash).
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieVal = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieVal) ? cookieVal : DEFAULT_LOCALE;
  return { locale, messages: await loadMessages(locale) };
});
