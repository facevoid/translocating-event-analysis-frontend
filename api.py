import sys
sys.path.append('/raid/scratch/mxs2361/projects/nanopore-signal-analysis')

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from signal_processing import SignalProcessor
from omegaconf import OmegaConf
from utils import load_dips_and_extract_all_features, select_features
from plot_utils import plot_dendrogram, plot_dips_by_cluster_matplotlib
from matplotlib import pyplot as plt
from fastapi.middleware.cors import CORSMiddleware
import numpy as np 
import re



# Your FastAPI app
app = FastAPI()

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

def load_features():
    return load_dips_and_extract_all_features(
        f"{config.dip_dir_prefix}/*",
        smoothing_function=SignalProcessor.wavelet_then_savgol,
        remove_context=True
    )

def get_filter_conditions(durationStart, durationEnd, depthStart, depthEnd, areaStart, areaEnd, inflectionStart, inflectionEnd, scale_factor):
    return {
        'Depth': lambda feature: depthStart <= feature[0] <= depthEnd if depthStart is not None and depthEnd is not None else True,
        'Area': lambda feature: areaStart <= feature[2] <= areaEnd if areaStart is not None and areaEnd is not None else True,
        'Inflection Count': lambda feature: inflectionStart <= feature[10] <= inflectionEnd if inflectionStart is not None and inflectionEnd is not None else True,
        'Dwelling Time': lambda feature: (durationStart / scale_factor) <= feature[8] <= (durationEnd / scale_factor) if durationStart is not None and durationEnd is not None else True,
    }

def filter_filenames(features, filenames, filter_conditions, primary_sort_feature):
    filtered_files = [filename for feature, filename in zip(features, filenames)
                      if all(condition(feature) for condition in filter_conditions.values())]
    sorted_files = sorted(filtered_files, key=lambda filename: features[filenames.index(filename)][primary_sort_feature])
    return sorted_files

def paginate_items(items, page, size):
    start = (page - 1) * size
    return items[start:start + size]

def load_data_from_files(filenames):
    all_data = []
    for filename in filenames:
        array_data = np.load(filename)
        all_data.append({"filename": filename, "data": array_data.tolist()})
    return all_data

@app.get("/get-data")
def get_data(durationStart: Optional[float] = None,
             durationEnd: Optional[float] = None,
             depthStart: Optional[float] = None,
             depthEnd: Optional[float] = None,
             areaStart: Optional[float] = None,
             areaEnd: Optional[float] = None,
             inflectionStart: Optional[float] = None,
             inflectionEnd: Optional[float] = None,
             page: int = Query(default=1, ge=1),
             size: int = Query(default=20, ge=1)):
    try:
        features, features_labels, filenames = load_features()
        scale_factor = 100000

        filter_conditions = get_filter_conditions(durationStart, durationEnd, depthStart, depthEnd, areaStart, areaEnd, inflectionStart, inflectionEnd, scale_factor)

        # Determine primary sort feature
        primary_sort_feature = 8  # Default to 'Dwelling Time' index
        if len(filter_conditions) == 1:
            primary_sort_feature = next((features_labels.index(key) for key in filter_conditions if key in features_labels), 8)

        selected_filenames = filter_filenames(features, filenames, filter_conditions, primary_sort_feature)
        page_filenames = paginate_items(selected_filenames, page, size)
        page_data = load_data_from_files(page_filenames)

        return page_data

    except Exception as e:
        print("Error occurred:", e)
        raise HTTPException(status_code=500, detail=str(e))



# Load configuration from a YAML file
config = OmegaConf.load('/raid/scratch/mxs2361/projects/nanopore-signal-analysis/configs/cluster-analysis.yaml')
