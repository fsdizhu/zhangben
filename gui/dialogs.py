import tkinter as tk
from tkinter import ttk, messagebox


class ConfirmDialog:
    """确认对话框组件"""
    
    def __init__(self, parent, title="确认", message="确定要执行此操作吗？", type="warning"):
        self.parent = parent
        self.title = title
        self.message = message
        self.type = type
        self.result = False
    
    def show(self):
        """显示确认对话框"""
        dialog = tk.Toplevel(self.parent)
        dialog.title(self.title)
        dialog.geometry("380x180")
        dialog.resizable(False, False)
        dialog.transient(self.parent)
        dialog.grab_set()
        
        # 设置对话框位置（居中）
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - (380 // 2)
        y = (dialog.winfo_screenheight() // 2) - (180 // 2)
        dialog.geometry(f"+{x}+{y}")
        
        # 样式
        style = ttk.Style(dialog)
        style.configure('Confirm.TFrame', background='#ffffff')
        style.configure('Confirm.TLabel', background='#ffffff')
        
        main_frame = ttk.Frame(dialog, style='Confirm.TFrame', padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 图标和消息
        icon_label = ttk.Label(main_frame, text="⚠️", font=('Arial', 32))
        icon_label.pack(pady=(0, 10))
        
        message_label = ttk.Label(main_frame, text=self.message, style='Confirm.TLabel', 
                                  font=('Arial', 12), wraplength=300, justify=tk.CENTER)
        message_label.pack(pady=(0, 20))
        
        # 按钮区域
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X)
        
        cancel_btn = ttk.Button(button_frame, text="取消", command=lambda: self._on_cancel(dialog))
        cancel_btn.pack(side=tk.RIGHT, padx=(10, 0))
        
        confirm_btn = ttk.Button(button_frame, text="确认", command=lambda: self._on_confirm(dialog))
        confirm_btn.pack(side=tk.RIGHT)
        
        dialog.protocol("WM_DELETE_WINDOW", lambda: self._on_cancel(dialog))
        dialog.wait_window()
        
        return self.result
    
    def _on_confirm(self, dialog):
        self.result = True
        dialog.destroy()
    
    def _on_cancel(self, dialog):
        self.result = False
        dialog.destroy()


class PasswordDialog:
    """密码输入对话框"""
    
    def __init__(self, parent, title="输入密码", message="请输入密码："):
        self.parent = parent
        self.title = title
        self.message = message
        self.password = None
    
    def show(self):
        """显示密码输入对话框"""
        dialog = tk.Toplevel(self.parent)
        dialog.title(self.title)
        dialog.geometry("320x160")
        dialog.resizable(False, False)
        dialog.transient(self.parent)
        dialog.grab_set()
        
        # 设置对话框位置（居中）
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - (320 // 2)
        y = (dialog.winfo_screenheight() // 2) - (160 // 2)
        dialog.geometry(f"+{x}+{y}")
        
        main_frame = ttk.Frame(dialog, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 消息
        message_label = ttk.Label(main_frame, text=self.message, font=('Arial', 12))
        message_label.pack(pady=(0, 15))
        
        # 密码输入框
        self.password_var = tk.StringVar()
        password_entry = ttk.Entry(main_frame, textvariable=self.password_var, 
                                   show="*", width=30, font=('Arial', 12))
        password_entry.pack(pady=(0, 15))
        password_entry.focus_set()
        
        # 按钮区域
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X)
        
        cancel_btn = ttk.Button(button_frame, text="取消", command=lambda: self._on_cancel(dialog))
        cancel_btn.pack(side=tk.RIGHT, padx=(10, 0))
        
        confirm_btn = ttk.Button(button_frame, text="确认", command=lambda: self._on_confirm(dialog))
        confirm_btn.pack(side=tk.RIGHT)
        
        # 回车键确认
        dialog.bind('<Return>', lambda e: self._on_confirm(dialog))
        dialog.protocol("WM_DELETE_WINDOW", lambda: self._on_cancel(dialog))
        
        dialog.wait_window()
        
        return self.password
    
    def _on_confirm(self, dialog):
        self.password = self.password_var.get()
        dialog.destroy()
    
    def _on_cancel(self, dialog):
        self.password = None
        dialog.destroy()


class InputDialog:
    """通用输入对话框"""
    
    def __init__(self, parent, title="输入", message="请输入：", default_value="", validate=None):
        self.parent = parent
        self.title = title
        self.message = message
        self.default_value = default_value
        self.validate = validate
        self.result = None
    
    def show(self):
        """显示输入对话框"""
        dialog = tk.Toplevel(self.parent)
        dialog.title(self.title)
        dialog.geometry("320x160")
        dialog.resizable(False, False)
        dialog.transient(self.parent)
        dialog.grab_set()
        
        # 设置对话框位置（居中）
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - (320 // 2)
        y = (dialog.winfo_screenheight() // 2) - (160 // 2)
        dialog.geometry(f"+{x}+{y}")
        
        main_frame = ttk.Frame(dialog, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 消息
        message_label = ttk.Label(main_frame, text=self.message, font=('Arial', 12))
        message_label.pack(pady=(0, 15))
        
        # 输入框
        self.input_var = tk.StringVar(value=self.default_value)
        input_entry = ttk.Entry(main_frame, textvariable=self.input_var, 
                                width=30, font=('Arial', 12))
        input_entry.pack(pady=(0, 15))
        input_entry.focus_set()
        input_entry.select_range(0, tk.END)
        
        # 按钮区域
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X)
        
        cancel_btn = ttk.Button(button_frame, text="取消", command=lambda: self._on_cancel(dialog))
        cancel_btn.pack(side=tk.RIGHT, padx=(10, 0))
        
        confirm_btn = ttk.Button(button_frame, text="确认", command=lambda: self._on_confirm(dialog))
        confirm_btn.pack(side=tk.RIGHT)
        
        # 回车键确认
        dialog.bind('<Return>', lambda e: self._on_confirm(dialog))
        dialog.protocol("WM_DELETE_WINDOW", lambda: self._on_cancel(dialog))
        
        dialog.wait_window()
        
        return self.result
    
    def _on_confirm(self, dialog):
        value = self.input_var.get().strip()
        
        if self.validate:
            try:
                self.validate(value)
            except ValueError as e:
                messagebox.showerror("错误", str(e))
                return
        
        self.result = value
        dialog.destroy()
    
    def _on_cancel(self, dialog):
        self.result = None
        dialog.destroy()


def show_confirm(parent, message, title="确认"):
    """快捷显示确认对话框"""
    dialog = ConfirmDialog(parent, title, message)
    return dialog.show()


def show_password(parent, message="请输入密码："):
    """快捷显示密码输入对话框"""
    dialog = PasswordDialog(parent, "输入密码", message)
    return dialog.show()


def show_input(parent, message, title="输入", default_value="", validate=None):
    """快捷显示输入对话框"""
    dialog = InputDialog(parent, title, message, default_value, validate)
    return dialog.show()
