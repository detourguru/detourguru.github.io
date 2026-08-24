+++
date = '{{ .Date }}'
draft = true
title = '{{ replace .File.ContentBaseName "-" " " | title }}'
description = ''
# data/tags.yaml > allowed에 가용 태그 리스트가 있음
tags = []
+++
