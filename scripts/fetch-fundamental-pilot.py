"""Compatibility entry point for runtime-cutoff SEC refresh; original files stay in cache."""
import argparse
import pathlib
import subprocess
parser=argparse.ArgumentParser()
parser.add_argument('output_directory',type=pathlib.Path)
parser.add_argument('--user-agent',required=True)
parser.add_argument('--as-of')
args=parser.parse_args()
command=['node',str(pathlib.Path(__file__).with_name('refresh-fundamentals.mjs')),'--cache',str(args.output_directory),'--user-agent',args.user_agent]
if args.as_of: command+=['--as-of',args.as_of]
subprocess.run(command,check=True)
