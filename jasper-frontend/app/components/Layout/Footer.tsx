import { AppUser } from "../../contexts/AuthContext";

interface Props {
  currentUser?: AppUser;
}

export function Footer({ currentUser }: Props) {
  return (
    <footer className="h-9 shrink-0 flex items-center justify-between px-4 md:px-6 bg-surface border-t border-gray-200/60 dark:border-gray-800/60 text-[11px] text-gray-600 dark:text-gray-400">
      <span className="hidden md:block">© 2026 Athabasca Watershed Stewardship. All rights reserved.</span>
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        System Latency: 42ms
        {currentUser && (
          <span className="hidden md:inline ml-3 text-gray-400 dark:text-gray-500">
            Signed in as <span className="font-medium text-gray-600 dark:text-gray-300">{currentUser.name}</span>
          </span>
        )}
      </span>
      <span className="hidden md:flex items-center gap-4">
        <span className="hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">Privacy Policy</span>
        <span className="hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">Data Terms</span>
        <span className="hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">API Docs</span>
      </span>
    </footer>
  );
}
