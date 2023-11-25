---
layout: post
title: '주어진 날짜만큼 순회하는 가장 좋은 방법을 찾아서'
subtitle: with PHP: date_diff, daysUntil 그리고 lte
cover-img: /assets/img/calendar.png
thumbnail-img: /assets/img/calendar.png
share-img: /assets/img/
tags: [PHP, Datetime, Carbon, Laravel]
author: Detourguru
---
# 주어진 날짜만큼 순회하는 가장 좋은 방법을 찾아서
제가 일하는 e-commerce 회사에서는 업계 특성 상 다양한 판매처의 API를 접하게 되는데, 특히 주문 데이터를 조회하는 요청을 보내는 코드를 작성할 일이 많습니다. 판매처에 주문 조회 요청을 보낼 때, 가장 먼저 해야할 일은 <u>클라이언트가 입력한 조회 일자만큼 요청을 보내는 것</u>입니다.

클라이언트들은 대개 한번의 요청으로 최대한 많은 데이터를 받기를 원합니다. 그러나 각 판매처마다 API가 다르다보니 어떤 판매처는 너무 긴 기간의 조회 요청을 넣으면 애초에 에러를 반환하기도 하고, 응답이 오기까지 너무 오래걸려 타임 아웃이 나기도 합니다.

많은 상황을 방지하고, 우리쪽의 리소스도 너무 많이 잡아먹지 않도록 하기 위해 받아온 날짜만큼 순회해서 요청을 보내는 방식을 선택했습니다.

이때 고려해야할 사항은, startDate와 endDate는 반드시 일자만 주어지는 것이 아니고 시분초가 포함된 datetime을 반환하기도 한다는 것입니다. 이때 24시간 미만의 시간도 순회에 포함되도록 해야합니다.

PHP 내장함수, Carbon 클래스에서 제공하는 함수 등 다양한 옵션이 있었는데, 제가 고민했던 세 함수를 비교하며 차이를 알아보겠습니다.

# date_diff
가장 먼저 선택한 방법은 PHP 내장함수인 `date_diff()` 입니다.

    $startDate = new \Datetime('2023-11-24');
    $endDate = new \Datetime('2023-11-25 12:30:00');
    $diff = date_diff($startDate, $endDate);
    
    $diff = date_diff($startDate, $endDate)->days;
    dd($diff);

    > 1

DateInterval 객체를 받아 days를 구해 그 차이만큼 for문을 돌며 request body에 하루씩의 날짜를 넣어 요청하기 위해 다음과 같이 코드를 작성했습니다.

    $targetDate = clone $startDate;
    for ($i = 0; $i <= $diff; $i++) {
        $params = [
            'startDate' => $targetDate,
            'endDate' => $targetDate
        ];
        dump($params);
        $targetDate->add(new DateInterval('P1D'));
    }

    > [[startDate] => 2023-11-24, [endDate] => 2023-11-24]
    > [[startDate] => 2023-11-25, [endDate] => 2023-11-25]


<details>
<summary><b>clone을 하는 이유</b></summary>
<div markdown="1">
PHP는 객체를 다른 변수에 할당할 때 <u>객체를 복사하는 것이 아니고 참조를 전달</u>합니다.

    $targetDate = $startDate;

이렇게 `$startDate`를 `$targetDate`에 복사하지 않고 바로 할당할 때, `$startDate`의 값인 `new \Datetime('2023-11-24');`가 복사되어 두 객체가 생겨나는 것이 아니라,
하나의 객체를 두 변수가 공유한다고 이해할 수 있습니다.

따라서 우리가 의도한대로 `$startDate`를 유지하고 `$targetDate`에만 1일씩 더해주며 순회를 하길 바란다면, `clone`을 이용해 객체를 복사해주어야합니다.
</div>
</details>


## 결론
보다시피 첫번째 코드에서 2023-11-25 00:00:00 ~ 2023-11-25 12:30:00까지의 시간은 순회에 포함되지 않았습니다. 이를 위해서 아래와 같이 수정해보았습니다.

    // endDate에 하루를 더하고 $diff를 구한다
    $endDate = $endDate->add(new DateInterval('P1D'));
    $diff = date_diff($startDate, $endDate)->days;

    $targetDate = clone $startDate;
    for ($i = 0; $i <= $diff; $i++) {
        $params = [
            'startDate' => $targetDate,
            'endDate' => $targetDate
        ];
        dump($params);
        $targetDate->add(new DateInterval('P1D'));
    }

    > [[startDate] => 2023-11-24, [endDate] => 2023-11-24]
    > [[startDate] => 2023-11-25, [endDate] => 2023-11-25]
    > [[startDate] => 2023-11-26, [endDate] => 2023-11-26] // 하루를 더 돌았다

이렇게 수정하면 2023-11-25 00:00:00 ~ 2023-11-25 12:30:00 까지의 시간이 커버가 되지만, 문제는 요청일자 중 endDate가 미래일자일 경우 에러를 내어주는 판매처도 있어서 또 다른 처리가 필요합니다. 

단순히 주어진 시간만큼 순회하면 되는 코드에서 너무 예외를 위한 추가 처리가 많이 필요해 date_diff는 제가 작성하려는 기능에 사용하기 적절하지 않아보였습니다.

### 장점
- PHP 내장함수라 다른 클래스를 가져올 필요없이 없이 바로 사용이 가능하다.
- 직관적인 함수명으로 어떤 역할을 하는지 바로 알 수 있다.

### 단점
- 순회를 할 때마다 `$targetDate`에 1일씩 더해주는 코드가 추가되어야한다.
- 순회 전 `$startDate`를 변수에 저장하고 1일씩 더해주기 위해 clone 해주어야한다.
- 시분초가 포함된 일자를 순회에 포함하지 않기 때문에 추가적인 작업이 필요하다.

# daysUntil
다음으로는 DateTime 클래스의 확장 기능을 제공하는 강력한 PHP 라이브러리인 Carbon의 내장함수 `daysUntil()`를 사용해보았습니다.

    use Carbon\Carbon;

    $startDate = Carbon::parse('2023-11-24');
    $endDate = Carbon::parse('2023-11-25 12:30:00');

    dd($startDate->daysUntil($endDate)->dateInterval->d);

    > 1

daysUntil은 <a href='https://carbon.nesbot.com/docs/'>주어진 두 날짜의 차이 만큼 iterable한 값을 반환</a>하기 때문에 날짜 차이를 구할 필요는 없지만, 확인을 위해 반환받은 CarbonPeriod 객체에서 `dateInterval->d`로 접근해 필요한 날짜 차이를 구해보았습니다. 반환된 값은 잘 확인했으니 이제는 순회해볼 차례입니다.

    $diff = $startDate->daysUntil($endDate);
    foreach ($diff as $day) {
        $params = [
            'startDate' => $day,
            'endDate' => $day
        ];
        dump($params);
    }

    > [[startDate] => 2023-11-24, [endDate] => 2023-11-24]
    > [[startDate] => 2023-11-25, [endDate] => 2023-11-25]

## 결론
daysUntil는 기준일자를 clone하거나 addDay()를 해줄 필요 없이 일자만큼 순회를 돌 수 있어 코드가 한결 간결해졌습니다. 그러나 date_diff와 동일하게 일자 차이는 1일밖에 안난다는 결과를 내어주어 결국 원하는 데이터를 얻지는 못했습니다.

마찬가지로 2023-11-25 00:00:00 ~ 2023-11-25 12:30:00 만큼 순회를 더 돌려면 추가 작업이 필요한 상황이 되었습니다.
### 장점
- 반환된 날짜를 받아서 바로 params에 넣어주면 되므로 코드가 간결해졌다.

### 단점
- 시분초가 포함된 일자를 순회에 포함하지 않기 때문에 추가적인 작업이 필요해 결론적으론 date_diff와 다르지 않다.

# lte
앞선 두 방식은 모두 일자 차이를 보고 그 차이를 기준으로 순회를 하는 코드였습니다. 

시분초도 비교 조건에 포함되면서 반환된 값을 기준으로 순회할 것이 아니라 이미 가지고 있는 값에서 하루씩 더해가도록 수정해야겠다는 데까지 생각이 미쳤습니다. 그러면 문제가 되었던 시분초 포함 일자도 순회에 포함할 수 있을 것 같다는 생각이 들었습니다.

그렇게 찾은 방법은 lte()함수입니다. 역시 Carbon 라이브러리에서 제공하는 함수로, 주어진 값이 대상보다 작거나 같은지 확인 후 참인지 거짓인지 반환을 해줍니다.

    use Carbon\Carbon;

    $startDate = Carbon::parse('2023-11-24');
    $endDate = Carbon::parse('2023-11-25 12:30:00');
    for ($targetDate = $startDate; $targetDate->lte($endDate);  $targetDate->addDay()) {
        $params = [
            'startDate' => $targetDate,
            'endDate' => $targetDate
        ];
        dump($params);
    }

    > [[startDate] => 2023-11-24, [endDate] => 2023-11-24]
    > [[startDate] => 2023-11-25, [endDate] => 2023-11-25]
    > [[startDate] => 2023-11-26, [endDate] => 2023-11-26]

## 결론
예상대로 `$targetDate->lte($endDate)`, 즉 `Carbon::parse('2023-11-25')->lte(Carbon::parse('2023-11-25 12:30:00'))` 조건에서 true를 반환해 원하던 대로 한번 더 순회를 돈 것을 확인할 수 있었습니다!

### 장점
- 일자 뿐만 아니라 시분초 단위로도 비교해 순회 카운트에 포함된다.
- 다른 두 함수가 가지고 있던 문제를 모두 해결했다.

### 단점
- lte라는 함수명에 익숙하지 않은 경우 함수명으로 무슨 역할을 하는지 한눈에 파악하기 쉽지 않을 수 있다.

## 정리
고작 날짜를 순회하기 위해 이렇게 많은 방식을 고민하고 택해보는 과정에서 각 함수의 특징에 대해 보다 더 잘알게 되었다. 다 유사해보여도 각각 차이와 그에 따른 장단점이 있어 다른 기능을 작업할 때 작업에 맞는 적절한 함수를 사용할 수 있는 힘을 기르게 된 계기가 된 것 같아 기쁘다.
