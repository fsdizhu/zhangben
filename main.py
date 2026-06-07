import tkinter as tk
from gui.login_window import LoginWindow


def main():
    """程序主入口"""
    # 创建登录窗口
    login_root = tk.Tk()
    login_window = LoginWindow(login_root)
    login_root.mainloop()

    # 如果登录成功，启动主应用
    if login_window.logged_in and login_window.current_user:
        from gui.main_window import AccountBookGUI

        root = tk.Tk()
        app = AccountBookGUI(root, current_user=login_window.current_user)
        root.mainloop()


if __name__ == "__main__":
    import sys
    import os
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)

    main()
