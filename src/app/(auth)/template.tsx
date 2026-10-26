import m from "./_components/auth-motion.module.css";

// A template remounts on every navigation inside (auth), so moving between
// sign-in, sign-up and recovery fades the card's content in rather than
// swapping it. The logo and the shell stay still.
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return <div className={m.page}>{children}</div>;
}
