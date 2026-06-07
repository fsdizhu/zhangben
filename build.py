#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
一键打包脚本 - 账本管理工具
运行此脚本即可自动重新打包项目为Windows可执行文件
"""

import os
import sys
import shutil
import subprocess
import time


def print_info(msg):
    """打印信息"""
    print(f"[INFO] {msg}")


def print_success(msg):
    """打印成功信息"""
    print(f"[SUCCESS] {msg}")


def print_error(msg):
    """打印错误信息"""
    print(f"[ERROR] {msg}")


def clean_build():
    """清理旧的构建文件"""
    print_info("正在清理旧的构建文件...")
    
    # 需要清理的目录和文件
    items_to_clean = [
        'build',
        'dist',
        '__pycache__',
        'gui/__pycache__',
        'utils/__pycache__',
    ]
    
    for item in items_to_clean:
        if os.path.exists(item):
            try:
                if os.path.isdir(item):
                    shutil.rmtree(item)
                    print_info(f"删除目录: {item}")
                else:
                    os.remove(item)
                    print_info(f"删除文件: {item}")
            except Exception as e:
                print_error(f"清理 {item} 失败: {e}")


def run_pyinstaller():
    """运行PyInstaller打包"""
    print_info("开始打包...")
    
    # 检查spec文件是否存在
    spec_file = "账本管理工具.spec"
    if not os.path.exists(spec_file):
        print_error(f"找不到spec文件: {spec_file}")
        return False
    
    # 构建PyInstaller命令
    cmd = ["pyinstaller", spec_file]
    
    try:
        # 执行打包命令，使用gbk编码处理Windows命令行输出
        result = subprocess.run(cmd, check=True, capture_output=True, text=True, encoding='gbk', errors='ignore')
        
        # 打印输出
        if result.stdout:
            output = result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout
            print_info("PyInstaller输出:")
            print(output)
        
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"打包失败: {e.returncode}")
        if e.stdout:
            print("标准输出:")
            print(e.stdout[-1000:] if len(e.stdout) > 1000 else e.stdout)
        if e.stderr:
            print("错误输出:")
            print(e.stderr[-1000:] if len(e.stderr) > 1000 else e.stderr)
        return False
    except Exception as e:
        print_error(f"执行命令失败: {e}")
        return False


def verify_output():
    """验证输出文件"""
    print_info("验证打包结果...")
    
    exe_path = os.path.join('dist', '账本管理工具.exe')
    if os.path.exists(exe_path):
        file_size = os.path.getsize(exe_path) / (1024 * 1024)  # MB
        print_success(f"打包成功!")
        print_success(f"输出文件: {os.path.abspath(exe_path)}")
        print_success(f"文件大小: {file_size:.2f} MB")
        return True
    else:
        print_error(f"打包失败: 未找到输出文件 {exe_path}")
        return False


def main():
    """主函数"""
    print("=" * 60)
    print("          账本管理工具 - 一键打包脚本")
    print("=" * 60)
    
    # 记录开始时间
    start_time = time.time()
    
    # 1. 清理旧文件
    clean_build()
    
    # 2. 运行PyInstaller
    if not run_pyinstaller():
        print_error("打包过程出错，已终止")
        sys.exit(1)
    
    # 3. 验证输出
    verify_output()
    
    # 计算耗时
    elapsed_time = time.time() - start_time
    print_success(f"打包完成! 总耗时: {elapsed_time:.2f} 秒")
    print("=" * 60)


if __name__ == "__main__":
    main()
