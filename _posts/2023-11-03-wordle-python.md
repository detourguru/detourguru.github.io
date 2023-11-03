---
layout: post
title: 파이썬으로 Wordle 만들기
subtitle: 그리고 플레이해보기
cover-img: /assets/img/wordle.png
thumbnail-img: /assets/img/wordle.png
share-img: /assets/img/wordle.png
tags: [python]
author: Detourguru
---

안녕하세요 디투입니다.
저는 요즘 [Wordle 워들](https://www.powerlanguage.co.uk/wordle/)이라는 게임에 푹 빠져있습니다!
![](/assets/img/wordle.png)

숫자야구와도 언뜻 비슷한 이 게임은 크로스워드 게임으로도 꽤 유명한 신문사 뉴욕타임즈에서 인수될 정도로 선풍적인 인기를 끈 게임입니다.

단 6번의 기회 내에 5글자 짜리 단어를 맞추면 되는 간단한 게임으로, 내가 입력한 글자가 단어 안에 있고 위치도 맞으면 초록색, 단어 안에는 있지만 위치가 다르면 노란색, 아예 없으면 빨간색으로 표시됩니다.

출퇴근시간에 틈틈히 플레이할 정도로 매우 쉽고 재미있는 게임인데요, 문득 플레이를 하다보니 파이썬으로 워들을 만들어볼 수 있겠다는 생각이 들었습니다.

그럼 아래부터는 코드 일부와 함께 간단한 설명을 드리겠습니다.

코드는 크게 두 부분으로 나뉘어져있습니다.
첫번째는 유효한 단어를 랜덤으로 생성해주는 단어 생성기 부분이고 두번째는 게임이 실행되는 부분입니다.

# 0. 필요한 라이브러리 가져오기

우선 필요한 라이브러리는 아래와 같습니다.
```
from english_words import get_english_words_set
import random
from colorama import Fore, Style
from datetime import dat
```
`english_words` 라는 라이브러리는 말 그대로 유효한 영단어를 가져오기 위해 import 했고,
`colorama`는 콘솔에 찍히는 텍스트에 색을 입혀주는 모듈입니다.
`random`과 `datetime` 함수는 익숙하시죠?
값을 랜덤으로 뽑아주고, 타임스탬프를 찍기위해 가져왔습니다.

# 1. 단어 랜덤 생성기
단어 생성기 함수부터 보겠습니다.

```
dic = get_english_words_set(['web2'])
alphabets = 'abcdefghijklmnopqrstuvwxyz'

def random_word_generator(num):
    while True:    
        letter = "".join(random.sample(alphabets, num))
        if (letter in dic) == True:
            break
    return letter
```

우선 영단어들을 불러와 전역변수 `dic`에, 알파벳 문자열은 `alphabets`에 각각 담았습니다.
함수 내에서는 `sample()` 함수를 이용해 주어진 num개 만큼 뽑고, 
뽑힌 단어가 유효한 단어인지를 `letter in dic` 으로 검증해주었습니다.

예를 들어 랜덤으로 생성된 단어가 "djwei"와 같이 존재하지 않는 단어라면 `False`,
"space"와 같이 유효하는 단어라면 `True`를 반환할 것입니다.
그리고 이 과정을 `while`문에 넣어 유효한 단어가 생성 될때 까지 돌리도록 했습니다.

소문자만 가지고 단어를 만들어주도록 제한하여 경우의 수가 비교적 적어서 금방 단어가 만들어지더라구요!
이게 랜덤으로 단어를 생성하는 코드의 끝입니다. 아주 간단하죠?


# 2. 워들

코드가 길진 않지만 한번에 보기엔 헷갈릴 것 같아 메인인 워들 부분은 끊어서 보도록 하겠습니다.

## 1. user input 유효성 검사
```
while True:
    life = life+1
    user_input = input('유효한 5자 단어를 입력해주세요: ').lower()
    
    # 5글자 입력이 아닐경우 & 존재하지 않는 단어일 때 무한 질문
    while (len(user_input) != 5) or ((user_input in dic) == False):
        user_input = input('유효하지 않은 단어입니다.\n단어 재입력: ').lower()
```
우선 아무 글자나 입력하거나 주어진 수 이상의 단어를 입력하는 것을 방지해주기 위해서
`while`문을 이용하여 위의 두가지 조건을 충족하지 못한다면 단어를 무한 재입력하도록 했습니다.

## 2. 입력된 input의 정확도 반환
워들에서는 세가지 경우의 수가 있습니다.
첫번째는 단어 내 알파벳이 존재하며, 위치도 동일한 경우. ==> 초록색
두번째는 단어 내 알파벳은 존재하나, 위치는 동일하지 않은 경우. ==> 노란색
세번째는 단어 내 알파벳이 존재하지 않는 경우입니다. ==> 빨간색

해당하는 케이스에 따라 입력받은 문자열에 색을 입혀서 반환해줍니다.
여기서 `colorama` 모듈의 함수를 사용하게 되는데요,
간단히 설명드리면  `Fore.색깔 + {string} + Style.RESET_ALL` 의 형식으로 작성하고 `print()`하면 콘솔에 색이 입혀진 텍스트로 출력됩니다.

`예) Fore.GREEN + str + Style.RESET_ALL `

위와 같이 작성하면 초록색 글씨가 출력되고 RED, YELLOW 등 다양한 색이 가능합니다.
`Style.RESET_ALL`을 작성하지 않으면 처음 초록색으로 입력된 글자 뒤의 모든 단어가 초록색이 되므로 꼭 매번 스타일 리셋을 해주어야합니다.
```
answer = []
for idx, val in enumerate(user_input):
    is_there = word.find(val)
    # 단어안에 해당 글자가 있을 경우
    if is_there != -1:
        # 위치까지 동일하면 초록
        if idx == is_there:
            char = Fore.GREEN + val + Style.RESET_ALL
        # 있지만 위치는 다르다면 노랑
        else:
            char = Fore.YELLOW + val + Style.RESET_ALL
        answer.append(char)
    # 단어안에 해당 글자가 아예 없으면 빨강
    elif is_there == -1:
        char = Fore.RED + val + Style.RESET_ALL
        for abt_idx, abt_val in enumerate(abt):
            if val in abt_val:
                abt[abt_idx] = char
        answer.append(char)
```
우선 파이썬 내장함수인 `enumerate()`를 사용한 것이 눈에 먼저 띄실 텐데요,
이 함수는 주어진 `list`에서 `index`와 `element`에 동시에 접근해 튜플로 반환해주어 리스트 내의 index에 쉽게 접근해 사용할 수 있는 유용한 함수입니다.

`enumerate()`로 리스트 내의 요소와 그 index를 가져온 후, `주어진 단어.find()`함수를 통해 user_input의 index와 answer의 index를 비교해 리턴되는 값에 따라 빨강, 초록, 노랑 중 무엇을 반환할지 결정하는 부분입니다.

`enumerate()` 함수의 예시는 아래와 같습니다.

```
# 예시
for i, j in enumerate(user_input):
    print(i, j)

# 반환
(0, 'apple')
(1, 'banana')
```

# 3. 플레이하기
코드의 핵심적인 부분은 위에서 모두 설명 해드렸습니다.
코드가 완성이 되었으니 플레이해볼까요?

```
wordle(random_word_generator(5))
```
`random_word_generator()` 함수에 5자 짜리 단어를 생성해주기 위해 5를 넣어주고 실행하면, 인풋창이 뜨게됩니다.
거기에 단어를 입력하고 6번 내에 단어를 맞춰보세요!!!

![](/assets/img/wordle-play.png)

저는 실제 워들처럼 공유용 status 등등 사소한 부분을 약간 추가해보았습니다.

전체 코드는 [제 깃헙](https://github.com/detourguru/python-scripts/tree/main/Wordle)에서 확인하실 수 있습니다.
