import tkinter as tk
from tkinter import ttk, messagebox
from user_auth import UserAuth


class LoginWindow:
    """登录窗口"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("登录")
        self.root.geometry("400x300")
        self.root.resizable(False, False)
        
        self.center_window()
        
        self.user_auth = UserAuth()
        
        self.create_login_widgets()
        
        self.logged_in = False
        self.current_user = None
        self.is_super_user = False
    
    def center_window(self):
        """使窗口居中显示"""
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f"{width}x{height}+{x}+{y}")
    
    def create_login_widgets(self):
        """创建登录界面组件"""
        frame = ttk.Frame(self.root, padding="20")
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text="用户名:", font=('Arial', 10)).pack(pady=5)
        self.username_var = tk.StringVar()
        self.username_entry = ttk.Entry(frame, textvariable=self.username_var, width=20)
        self.username_entry.pack(pady=5)
        
        ttk.Label(frame, text="密码:", font=('Arial', 10)).pack(pady=5)
        self.password_var = tk.StringVar()
        self.password_entry = ttk.Entry(frame, textvariable=self.password_var, show="*", width=20)
        self.password_entry.pack(pady=5)
        
        button_frame = ttk.Frame(frame)
        button_frame.pack(pady=20)
        
        ttk.Button(button_frame, text="登录", command=self.login, width=15).pack(side=tk.LEFT, padx=15)
        ttk.Button(button_frame, text="取消", command=self.root.quit, width=15).pack(side=tk.LEFT, padx=15)
        
        reset_frame = ttk.Frame(frame)
        reset_frame.pack(pady=10)
        ttk.Button(reset_frame, text="忘记密码", command=self.forgot_password, width=15).pack()
        
        self.username_var.set("root")
        
        self.root.bind('<Return>', lambda event: self.login())
    
    def login(self):
        """处理登录逻辑"""
        username = self.username_var.get().strip()
        password = self.password_var.get().strip()
        
        if not username or not password:
            messagebox.showwarning("警告", "请输入用户名和密码")
            return
        
        success, user, is_super = self.user_auth.login(username, password)
        
        if success:
            self.logged_in = True
            self.current_user = user
            self.is_super_user = is_super
            self.root.destroy()
        else:
            messagebox.showerror("错误", "用户名或密码错误")
    
    def forgot_password(self):
        """忘记密码功能"""
        forgot_window = tk.Toplevel(self.root)
        forgot_window.title("忘记密码")
        forgot_window.geometry("400x400")
        forgot_window.transient(self.root)
        forgot_window.grab_set()
        
        forgot_window.update_idletasks()
        width = 400
        height = 400
        x = (forgot_window.winfo_screenwidth() // 2) - (width // 2)
        y = (forgot_window.winfo_screenheight() // 2) - (height // 2)
        forgot_window.geometry(f"{width}x{height}+{x}+{y}")
        
        frame = ttk.Frame(forgot_window, padding="20")
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text="用户名:").pack(pady=8)
        username_var = tk.StringVar()
        username_entry = ttk.Entry(frame, textvariable=username_var, width=20)
        username_entry.pack(pady=8)
        
        ttk.Label(frame, text="验证方式:").pack(pady=8)
        
        super_frame = ttk.Frame(frame)
        super_frame.pack(pady=4)
        ttk.Label(super_frame, text="超级用户验证码:").pack(side=tk.LEFT, padx=5)
        super_code_var = tk.StringVar()
        super_code_entry = ttk.Entry(super_frame, textvariable=super_code_var, show="*", width=15)
        super_code_entry.pack(side=tk.LEFT, padx=5)
        
        normal_frame = ttk.Frame(frame)
        normal_frame.pack(pady=4)
        ttk.Label(normal_frame, text="超级用户密码:").pack(side=tk.LEFT, padx=5)
        admin_password_var = tk.StringVar()
        admin_password_entry = ttk.Entry(normal_frame, textvariable=admin_password_var, show="*", width=15)
        admin_password_entry.pack(side=tk.LEFT, padx=5)
        
        ttk.Label(frame, text="新密码:").pack(pady=8)
        new_password_var = tk.StringVar()
        new_password_entry = ttk.Entry(frame, textvariable=new_password_var, show="*", width=20)
        new_password_entry.pack(pady=8)
        
        ttk.Label(frame, text="确认新密码:").pack(pady=8)
        confirm_password_var = tk.StringVar()
        confirm_password_entry = ttk.Entry(frame, textvariable=confirm_password_var, show="*", width=20)
        confirm_password_entry.pack(pady=8)
        
        def confirm_reset():
            username = username_var.get().strip()
            super_code = super_code_var.get().strip()
            admin_password = admin_password_var.get().strip()
            new_password = new_password_var.get().strip()
            confirm_password = confirm_password_var.get().strip()
            
            if not username:
                messagebox.showwarning("警告", "请输入用户名")
                return
            
            if username not in self.user_auth.get_all_users():
                messagebox.showwarning("警告", "用户名不存在")
                return
            
            if not new_password:
                messagebox.showwarning("警告", "请输入新密码")
                return
            
            if new_password != confirm_password:
                messagebox.showwarning("警告", "两次输入的密码不一致")
                return
            
            if username == "root":
                success, msg = self.user_auth.reset_password(username, new_password, super_code)
            else:
                success, msg = self.user_auth.reset_password(username, new_password, admin_password)
            
            if success:
                messagebox.showinfo("成功", msg)
                forgot_window.destroy()
            else:
                messagebox.showwarning("警告", msg)
        
        button_frame = ttk.Frame(frame)
        button_frame.pack(pady=20)
        ttk.Button(button_frame, text="确认", command=confirm_reset).pack(side=tk.LEFT, padx=10)
        ttk.Button(button_frame, text="取消", command=forgot_window.destroy).pack(side=tk.LEFT, padx=10)
        
        forgot_window.bind('<Return>', lambda event: confirm_reset())